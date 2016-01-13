using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Owin;
using Microsoft.Owin;

namespace Sistrategia.Overmind.Owin
{
    public static class OwinContextExtensions
    {
        private static readonly string OvermindKeyPrefix = "Sistrategia.Overmind.Owin:";

        private static string GetKey(Type t) {
            return OvermindKeyPrefix + t.AssemblyQualifiedName;
        }

        /// <summary>
        ///     Stores an object in the OwinContext using a key based on the AssemblyQualified type name
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="context"></param>
        /// <param name="value"></param>
        /// <returns></returns>
        public static IOwinContext Set<T>(this IOwinContext context, T value) {
            if (context == null) {
                throw new ArgumentNullException("context");
            }
            return context.Set(GetKey(typeof(T)), value);
        }

        /// <summary>
        ///     Retrieves an object from the OwinContext using a key based on the AssemblyQualified type name
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="context"></param>
        /// <returns></returns>
        public static T Get<T>(this IOwinContext context) {
            if (context == null) {
                throw new ArgumentNullException("context");
            }
            return context.Get<T>(GetKey(typeof(T)));
        }
    }
}
