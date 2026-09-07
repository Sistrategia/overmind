using Sistrategia.Overmind.WebAPI.Contacts;

var builder = WebApplication.CreateBuilder(args);
ContactApiHosting.ConfigureServices(builder);
var app = builder.Build();
ContactApiHosting.ConfigurePipeline(app);
app.Run();
