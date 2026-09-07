using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sistrategia.Data.SqlClient.Contacts;
using Sistrategia.Data.SqlClient.Security;
using Sistrategia.Overmind.WebAPI.Contacts;

namespace Sistrategia.Overmind.WebAPI.Controllers;

public sealed record UserHttpPromotion(int ExpectedEntityVersion, UserAccountInput Account, IReadOnlyList<ContactCommand>? Commands = null);

[ApiController, Route("api/users"), Authorize]
public sealed class UsersController(IUserProvisioningService service) : ControllerBase
{
    [HttpPost, ProducesResponseType<UserProvisioningResult>(201)]
    public async Task<ActionResult<UserProvisioningResult>> Create(CancellationToken cancellationToken) {
        CheckQuery();
        var request = await ContactWireJson.ReadAsync<CreateUserRequest>(Request, cancellationToken);
        var result = await service.CreateAsync(request, cancellationToken);
        return Created($"/api/contacts/{result.PublicKey:D}", result);
    }

    [HttpPost("{contact:guid}/promote"), ProducesResponseType<UserProvisioningResult>(200)]
    public async Task<ActionResult<UserProvisioningResult>> Promote(Guid contact, CancellationToken cancellationToken) {
        CheckQuery();
        var request = await ContactWireJson.ReadAsync<UserHttpPromotion>(Request, cancellationToken);
        return Ok(await service.PromoteAsync(new(contact, request.ExpectedEntityVersion, request.Account, request.Commands), cancellationToken));
    }
    private void CheckQuery() {
        if (Request.Query.Count != 0) throw new ContactHttpInputException(400, "validation");
    }
}
