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
    public static class DataOwinContextExtensions
    {
        /// <summary>
        ///     Get the user manager from the context
        /// </summary>
        /// <typeparam name="TManager"></typeparam>
        /// <param name="context"></param>
        /// <returns></returns>
        public static TDataManager GetDataManager<TDataManager>(this IOwinContext context) {
            if (context == null) {
                throw new ArgumentNullException("context");
            }
            return context.Get<TDataManager>();
        }
    }
}
