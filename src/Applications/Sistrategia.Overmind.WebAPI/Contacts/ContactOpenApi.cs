using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Sistrategia.Data.SqlClient.Contacts;
using Sistrategia.Data.SqlClient.Security;
using Sistrategia.Overmind.WebAPI.Controllers;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Sistrategia.Overmind.WebAPI.Contacts;

/// <summary>Document the bounded manual JSON reader and its closed discriminator map.</summary>
public sealed class ContactOpenApi : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context) {
        var users = context.MethodInfo.DeclaringType == typeof(UsersController);
        if (!users && context.MethodInfo.DeclaringType != typeof(ContactsController)) return;
        var create = context.MethodInfo.Name == "Create";
        if (!create && context.MethodInfo.Name != "Save" && context.MethodInfo.Name != "Promote") return;
        var requestType = users ? (create ? typeof(CreateUserRequest) : typeof(UserHttpPromotion)) :
            (create ? typeof(ContactCreateRequest) : typeof(ContactHttpSave));
        var reference = context.SchemaGenerator.GenerateSchema(requestType, context.SchemaRepository);
        var body = context.SchemaRepository.Schemas[reference.Reference.Id];
        body.AdditionalPropertiesAllowed = false;
        body.Required.UnionWith(create ? ["profile"] : new[] { "expectedEntityVersion" });
        if (users) {
            body.Required.Add("account");
            var account = context.SchemaRepository.Schemas[body.Properties["account"].Reference.Id];
            account.Required.UnionWith(["loginName", "password"]);
            account.AdditionalPropertiesAllowed = false;
            account.Properties["password"].WriteOnly = true;
            account.Properties["password"].Format = "password";
            account.Properties["password"].MinLength = 15;
            account.Properties["password"].MaxLength = 128;
        } else if (!create) body.Required.Add("commands");
        if (!create) body.Properties["expectedEntityVersion"].Minimum = 1;
        var alternatives = new List<OpenApiSchema>();
        var mapping = new Dictionary<string, string>();
        foreach (var (kind, type) in ContactWireJson.CommandTypes) {
            if (users && kind is "contact.delete" or "contact.restore") continue;
            var schemaReference = context.SchemaGenerator.GenerateSchema(type, context.SchemaRepository);
            var schema = context.SchemaRepository.Schemas[schemaReference.Reference.Id];
            schema.AdditionalPropertiesAllowed = false;
            schema.Properties["kind"] = new OpenApiSchema { Type = "string", Enum = [new OpenApiString(kind)] };
            schema.Required.Add("kind");
            var constructor = type.GetConstructors().OrderByDescending(c => c.GetParameters().Length).First();
            foreach (var parameter in constructor.GetParameters().Where(p => !p.HasDefaultValue))
                schema.Required.Add(System.Text.Json.JsonNamingPolicy.CamelCase.ConvertName(parameter.Name!));
            foreach (var name in new[] { "ordinal", "displayOrder" }) if (schema.Properties.TryGetValue(name, out var position)) position.Minimum = 1;
            alternatives.Add(schemaReference);
            mapping[kind] = "#/components/schemas/" + schemaReference.Reference.Id;
        }
        body.Properties["commands"] = new OpenApiSchema {
            Type = "array", MaxItems = 256, MinItems = create || users ? 0 : 1, Nullable = create || users,
            Items = new OpenApiSchema { OneOf = alternatives, Discriminator = new OpenApiDiscriminator { PropertyName = "kind", Mapping = mapping } }
        };
        operation.RequestBody = new OpenApiRequestBody {
            Required = true, Description = "At most 1 MiB. Strict camelCase JSON; unknown/duplicate fields reject. Commands execute in list order in one Save.",
            Content = { ["application/json"] = new OpenApiMediaType { Schema = reference } }
        };
    }
}
