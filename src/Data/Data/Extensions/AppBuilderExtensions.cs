using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Owin;
using Microsoft.Owin;
using Sistrategia.Overmind.Owin;

namespace Sistrategia.Overmind.Data.Owin
{
    public static class DataAppBuilderExtensions
    {
        public static IAppBuilder CreatePerOwinContext<T>(this IAppBuilder app,
            Func<DataFactoryOptions<T>, IOwinContext, T> createCallback) where T : class, IDisposable {
            if (app == null) {
                throw new ArgumentNullException("app");
            }
            return app.CreatePerOwinContext(createCallback, (options, instance) => instance.Dispose());
        }

        public static IAppBuilder CreatePerOwinContext<T>(this IAppBuilder app,
           Func<DataFactoryOptions<T>, IOwinContext, T> createCallback,
           Action<DataFactoryOptions<T>, T> disposeCallback) where T : class, IDisposable {
            if (app == null) {
                throw new ArgumentNullException("app");
            }
            if (createCallback == null) {
                throw new ArgumentNullException("createCallback");
            }
            if (disposeCallback == null) {
                throw new ArgumentNullException("disposeCallback");
            }

            app.Use(typeof(DataFactoryMiddleware<T, DataFactoryOptions<T>>),
                new DataFactoryOptions<T> {
                    //DataProtectionProvider = app.GetDataProtectionProvider(),
                    Provider = new DataFactoryProvider<T> {
                        OnCreate = createCallback,
                        OnDispose = disposeCallback
                    }
                });
            return app;
        }
    }
}
