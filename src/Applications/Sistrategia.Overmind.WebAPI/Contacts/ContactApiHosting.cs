using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Sistrategia.Data.SqlClient.Contacts;
using Sistrategia.Data.SqlClient.Extensions;
using Sistrategia.Overmind.Data.SqlClient;

namespace Sistrategia.Overmind.WebAPI.Contacts;

/// <summary>Shared production composition, also exercised by the in-process HTTP integration tests.</summary>
public static class ContactApiHosting
{
    public const string SchemaMaintenance = "SchemaMaintenance";

    public static void ConfigureServices(WebApplicationBuilder builder) {
        var authority = Required(builder.Configuration, "ContactAuthentication:Authority");
        var issuer = Required(builder.Configuration, "ContactAuthentication:Issuer");
        var audience = Required(builder.Configuration, "ContactAuthentication:Audience");
        if (!Uri.TryCreate(authority, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps ||
            !string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment))
            throw new InvalidOperationException("ContactAuthentication:Authority must be an HTTPS metadata authority.");
        builder.Services.AddSistrategiaSqlDatabase<OvermindSqlDatabaseManager>(builder.Configuration);
        builder.Services.AddSqlContactService(Required(builder.Configuration, "ConnectionStrings:DefaultConnection"));
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddScoped<IContactContextAccessor, HttpContactContext>();
        builder.Services.AddScoped<IContactAuthorizer, JwtContactAuthorizer>();
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options => {
            options.Authority = authority;
            options.Audience = audience;
            options.RequireHttpsMetadata = true;
            options.MapInboundClaims = false;
            options.SaveToken = false;
            options.IncludeErrorDetails = false;
            options.TokenValidationParameters = new TokenValidationParameters {
                ValidateIssuer = true, ValidIssuer = issuer,
                IssuerValidator = (actual, _, _) => actual == issuer ? actual : throw new SecurityTokenInvalidIssuerException(),
                ValidateAudience = true, ValidAudience = audience,
                ValidateIssuerSigningKey = true, RequireSignedTokens = true,
                ValidateLifetime = true, RequireExpirationTime = true, ClockSkew = TimeSpan.FromSeconds(30),
                ValidAlgorithms = [SecurityAlgorithms.RsaSha256, SecurityAlgorithms.RsaSsaPssSha256, SecurityAlgorithms.EcdsaSha256]
            };
            options.Events = new JwtBearerEvents {
                OnTokenValidated = context => {
                    if (context.Principal is null || ContactClaims.Resolve(context.Principal) is null)
                        context.Fail("Actor and tenant claims are required and must be unambiguous.");
                    return Task.CompletedTask;
                },
                OnChallenge = context => {
                    context.HandleResponse();
                    context.Response.Headers.WWWAuthenticate = "Bearer";
                    return ContactHttpErrors.Write(context.HttpContext, 401, "unauthenticated");
                },
                OnForbidden = context => ContactHttpErrors.Write(context.HttpContext, 403, "forbidden")
            };
        });
        builder.Services.AddAuthorization(options => {
            options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
            options.AddPolicy(SchemaMaintenance, policy => policy.RequireAuthenticatedUser()
                .RequireClaim(ContactClaims.SchemaAdmin, "true")
                .RequireAssertion(_ => builder.Environment.IsDevelopment() &&
                    builder.Configuration.GetValue<bool>("Development:EnableSchemaEndpoints")));
        });
        builder.Services.AddControllers().AddJsonOptions(options => ContactWireJson.Configure(options.JsonSerializerOptions))
            .ConfigureApiBehaviorOptions(options => {
                options.InvalidModelStateResponseFactory = context => new BadRequestObjectResult(
                    ContactHttpErrors.Problem(context.HttpContext, 400, "validation")) {
                    ContentTypes = { "application/problem+json" }
                };
            });
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(options => {
            options.OperationFilter<ContactOpenApi>();
            options.MapType<long>(() => new OpenApiSchema { Type = "string", Pattern = "^-?[0-9]+$", Description = "Exact decimal Int64." });
            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" });
            options.AddSecurityRequirement(new OpenApiSecurityRequirement {
                [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = []
            });
        });
    }

    public static void ConfigurePipeline(WebApplication app) {
        app.Use(ContactHttpErrors.Boundary);
        if (app.Environment.IsDevelopment()) {
            app.UseSwagger();
            app.UseSwaggerUI();
            AppDomain.CurrentDomain.SetData("DataDirectory", Path.Combine(app.Environment.ContentRootPath, "App_Data"));
        }
        app.UseHttpsRedirection();
        app.UseRouting();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();
    }
    private static string Required(IConfiguration configuration, string name) =>
        !string.IsNullOrWhiteSpace(configuration[name]) ? configuration[name]! :
            throw new InvalidOperationException($"Required configuration is missing: {name}.");
}
