using Microsoft.AspNetCore.Mvc;
using Sistrategia.Data.SqlClient;
using Sistrategia.Data.SqlClient.Contacts;

namespace Sistrategia.Overmind.WebAPI.Contacts;

public sealed class ContactHttpInputException(int status, string code) : Exception(code)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}

public static class ContactHttpErrors
{
    public static ProblemDetails Problem(HttpContext context, int status, string code) => new() {
        Status = status, Title = code.Replace('_', ' '), Type = $"urn:overmind:problem:{code}",
        Extensions = { ["code"] = code, ["traceId"] = context.TraceIdentifier, ["automaticRetryAllowed"] = false }
    };
    public static Task Write(HttpContext context, int status, string code) {
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(Problem(context, status, code),
            options: null, contentType: "application/problem+json", cancellationToken: CancellationToken.None);
    }

    public static async Task Boundary(HttpContext context, RequestDelegate next) {
        if (!context.Request.Path.StartsWithSegments("/api/contacts") && !context.Request.Path.StartsWithSegments("/api/users")) {
            await next(context); return;
        }
        context.Response.Headers.CacheControl = "no-store";
        try { await next(context); }
        catch (Exception error) when (!context.Response.HasStarted) {
            if (error is OperationCanceledException && context.RequestAborted.IsCancellationRequested) {
                context.Abort(); // A disconnected caller cannot receive a reliable response.
                return;
            }
            var (status, code) = error switch {
                ContactHttpInputException input => (input.Status, input.Code),
                ContactServiceException { Failure: ContactFailure.Validation } => (400, "validation"),
                ContactServiceException { Failure: ContactFailure.Forbidden } => (403, "forbidden"),
                ContactServiceException { Failure: ContactFailure.NotFound } => (404, "not_found"),
                ContactServiceException { Failure: ContactFailure.Conflict } => (409, "conflict"),
                ContactServiceException { Failure: ContactFailure.Dependency } => (409, "dependency"),
                ContactServiceException { Failure: ContactFailure.HistoryUnavailable } => (409, "history_unavailable"),
                AuditUnitCommitUncertainException => (500, "commit_uncertain"),
                OperationCanceledException => (408, "cancelled"),
                _ => (500, "storage")
            };
            if (status == 500) context.RequestServices.GetRequiredService<ILoggerFactory>()
                .CreateLogger("ContactHttp").LogError(error, "Contact request failed. Trace {TraceId}", context.TraceIdentifier);
            // Never serialize exception messages, SQL text, tokens or provisional commit stamps.
            await Write(context, status, code);
        }
    }
}
