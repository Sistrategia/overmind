using Sistrategia.Data.SqlClient.Extensions;
using Sistrategia.Overmind.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);

// Configure Sistrategia Database services for SQL Server - clean, provider-specific approach
builder.Services.AddSistrategiaSqlDatabase<OvermindSqlDatabaseManager>(
    builder.Configuration,
    configureOptions: options => {
        // Add any additional schema builders specific to your application
        // options.AddSchemaBuilder<CustomExtemdedSchemaBuilder>();
        // options.AddSchemaBuilder<AnotherSchemaBuilder>();
    });

// builder.Services.AddLocalization();
builder.Services.AddControllers()
    .AddJsonOptions(options => {
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
        // Ensure dictionary keys (e.g., ValidationProblemDetails.errors) serialize in camelCase
        options.JsonSerializerOptions.PropertyNamingPolicy ??= System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    })
    // .AddDataAnnotationsLocalization(options => {
    //     // Ensure DataAnnotations look up messages from shared resources
    //     options.DataAnnotationLocalizerProvider = (type, factory) =>
    //         factory.Create(typeof(Sistrategia.Conexus.Server.WebAPI.SharedResource));
    // })
    ;

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment()) {
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseDeveloperExceptionPage();
    //app.UseHsts(); // 30 days    
    AppDomain.CurrentDomain.SetData(
        "DataDirectory",
        Path.Combine(app.Environment.ContentRootPath,
            "App_Data"));
} else {
    //app.UseExceptionHandler("/Home/Error");
    //app.UseHsts(); // 30 days  
}

app.UseHttpsRedirection();
// app.UseStaticFiles();

app.UseRouting();

app.UseCors();

// app.UseAuthentication();
// app.UseAuthorization();

// Activity logging middleware - logs all authenticated API requests (573-T002)
// app.UseActivityLogging();

app.MapControllers();

// app.MapGet("/", () => "Hello World!");

app.Run();
