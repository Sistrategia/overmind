﻿using System;
using System.Threading.Tasks;
using System.Web.Mvc;
using System.Web.Routing;
using Microsoft.Owin;
using Owin;

[assembly: OwinStartup(typeof(Sistrategia.Overmind.WebApp.Startup))]

namespace Sistrategia.Overmind.WebApp
{
    public class Startup
    {
        public void Configuration(IAppBuilder app) {
            // For more information on how to configure your application, visit http://go.microsoft.com/fwlink/?LinkID=316888

            RouteConfig.RegisterRoutes(RouteTable.Routes);


        }
    }
}
