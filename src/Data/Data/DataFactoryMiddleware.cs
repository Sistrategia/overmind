using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Owin;
using Microsoft.Owin;
using Sistrategia.Overmind.Owin;

namespace Sistrategia.Overmind.Data
{
    public class DataFactoryMiddleware<TResult, TOptions> : OwinMiddleware
        where TResult : IDisposable
        where TOptions : DataFactoryOptions<TResult>
    {
        public DataFactoryMiddleware(OwinMiddleware next, TOptions options)
            : base(next) {
            if (options == null) {
                throw new ArgumentNullException("options");
            }
            if (options.Provider == null) {
                throw new ArgumentNullException("options.Provider");
            }
            Options = options;
        }

        public TOptions Options { get; private set; }

        public override async Task Invoke(IOwinContext context) {
            var instance = Options.Provider.Create(Options, context);
            try {
                context.Set(instance);
                if (Next != null) {
                    await Next.Invoke(context);
                }
            }
            finally {
                Options.Provider.Dispose(Options, instance);
            }
        }
    }
}
