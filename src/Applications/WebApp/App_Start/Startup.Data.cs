using System;
using System.Configuration;
using System.Threading.Tasks;
using Owin;
using Microsoft.Owin;
using Sistrategia.Overmind.Data;
using Sistrategia.Overmind.Data.Owin;
using Sistrategia.Overmind.Data.EF6Client;
using Sistrategia.Overmind.Data.EF6Client.AspNetIdentityProvider;

namespace Sistrategia.Overmind.WebApp
{
    public partial class Startup
    {
        public void ConfigureData(IAppBuilder app) {
            app.CreatePerOwinContext<DataManager>(DataManager.Create);
        }
    }
}