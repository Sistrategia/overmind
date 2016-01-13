using Microsoft.Owin;
using Owin;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Sistrategia.Overmind.Owin
{
    ///// <summary>
    /////     Extensions off of IAppBuilder to configure the Sistrategia's middleware
    ///// </summary>
    //public static class AppBuilderExtensions
    //{
    //    private const string CookiePrefix = ".Sistrategia.Overmind.";

    //    public static IAppBuilder CreatePerOwinContext<T>(this IAppBuilder app,
    //        Func<T> createCallback)
    //        where T : class, IDisposable {
    //        return CreatePerOwinContext<T>(app, (options, context) => createCallback());
    //    }

    //    public static IAppBuilder CreatePerOwinContext<T>(this IAppBuilder app,
    //        Func<IOwinContext, T> createCallback)
    //        where T : class, IDisposable {
    //        return CreatePerOwinContext<T>(app, (options, context) => createCallback());
    //    }

    //    //public static IAppBuilder CreatePerOwinContext<T>(this IAppBuilder app,
    //    //    Func<DataFactoryOptions<T>, IOwinContext, T> createCallback) where T : class, IDisposable {
    //    //    if (app == null) {
    //    //        throw new ArgumentNullException("app");
    //    //    }
    //    //    return app.CreatePerOwinContext(createCallback, (options, instance) => instance.Dispose());
    //    //}
    //}
}
