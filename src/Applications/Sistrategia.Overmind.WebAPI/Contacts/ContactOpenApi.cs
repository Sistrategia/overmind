using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Sistrategia.Data.SqlClient.Contacts;
using Sistrategia.Overmind.WebAPI.Controllers;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Sistrategia.Overmind.WebAPI.Contacts;

/// <summary>Document the bounded manual JSON reader and its closed discriminator map.</summary>
public sealed class ContactOpenApi : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context) {
        if (context.MethodInfo.DeclaringType != typeof(ContactsController)) return;
        var create = context.MethodInfo.Name == nameof(ContactsController.Create);
        if (!create && context.MethodInfo.Name != nameof(ContactsController.Save)) return;
        var reference = context.SchemaGenerator.GenerateSchema(create ? typeof(ContactCreateRequest) : typeof(ContactHttpSave), context.SchemaRepository);
        var body = context.SchemaRepository.Schemas[reference.Reference.Id];
        body.AdditionalPropertiesAllowed = false;
        body.Required.UnionWith(create ? ["profile"] : new[] { "expectedEntityVersion", "commands" });
        if (!create) body.Properties["expectedEntityVersion"].Minimum = 1;
        var alternatives = new List<OpenApiSchema>();
        var mapping = new Dictionary<string, string>();
        foreach (var (kind, type) in ContactWireJson.CommandTypes) {
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
            Type = "array", MaxItems = 256, MinItems = create ? 0 : 1, Nullable = create,
            Items = new OpenApiSchema { OneOf = alternatives, Discriminator = new OpenApiDiscriminator { PropertyName = "kind", Mapping = mapping } }
        };
        operation.RequestBody = new OpenApiRequestBody {
            Required = true, Description = "At most 1 MiB. Strict camelCase JSON; unknown/duplicate fields reject. Commands execute in list order in one Save.",
            Content = { ["application/json"] = new OpenApiMediaType { Schema = reference } }
        };
    }
}
