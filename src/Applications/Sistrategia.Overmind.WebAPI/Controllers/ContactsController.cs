using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sistrategia.Data.SqlClient;
using Sistrategia.Data.SqlClient.Contacts;
using Sistrategia.Overmind.WebAPI.Contacts;

namespace Sistrategia.Overmind.WebAPI.Controllers;

[ApiController, Route("api/contacts"), Authorize]
public sealed class ContactsController(IContactService service) : ControllerBase
{
    [HttpPost, ProducesResponseType<ContactSaveResult>(201)]
    public async Task<ActionResult<ContactSaveResult>> Create(CancellationToken cancellationToken) {
        CheckQuery();
        var request = await ContactWireJson.ReadAsync<ContactCreateRequest>(Request, cancellationToken);
        var result = await service.CreateAsync(request, cancellationToken);
        return Created($"/api/contacts/{result.PublicKey:D}", result);
    }

    [HttpPost("{contact:guid}/save"), ProducesResponseType<ContactSaveResult>(200)]
    public async Task<ActionResult<ContactSaveResult>> Save(Guid contact, CancellationToken cancellationToken) {
        CheckQuery();
        var request = await ContactWireJson.ReadAsync<ContactHttpSave>(Request, cancellationToken);
        return Ok(await service.SaveAsync(new(contact, request.ExpectedEntityVersion, request.Commands), cancellationToken));
    }

    [HttpGet("{contact:guid}"), ProducesResponseType<ContactDetail>(200)]
    public async Task<ActionResult<ContactDetail>> Current(Guid contact, CancellationToken cancellationToken) {
        CheckQuery();
        return Ok(await service.ReadCurrentAsync(contact, cancellationToken));
    }

    [HttpGet("{contact:guid}/revisions/{entityVersion:int}"), ProducesResponseType<ContactRevision>(200)]
    public async Task<ActionResult<ContactRevision>> Revision(Guid contact, int entityVersion,
        [FromQuery] int? compareEntityVersion, CancellationToken cancellationToken) {
        CheckQuery("compareEntityVersion");
        return Ok(await service.ReadRevisionAsync(contact, entityVersion, compareEntityVersion, cancellationToken));
    }

    [HttpGet("{contact:guid}/directory"), ProducesResponseType<ContactDirectoryDetail>(200)]
    public async Task<ActionResult<ContactDirectoryDetail>> Directory(Guid contact, CancellationToken cancellationToken) {
        CheckQuery();
        return Ok(await service.ReadDirectoryAsync(contact, cancellationToken));
    }

    private void CheckQuery(params string[] allowed) {
        if (Request.Query.Any(pair => !allowed.Contains(pair.Key, StringComparer.Ordinal) || pair.Value.Count != 1))
            throw new ContactHttpInputException(400, "validation");
    }
}
