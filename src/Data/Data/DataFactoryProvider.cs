using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Owin;
using Microsoft.Owin;

namespace Sistrategia.Overmind.Data
{
    public class DataFactoryProvider<T> : IDataFactoryProvider<T> where T : class, IDisposable
    {
        public DataFactoryProvider() {
            OnDispose = (options, instance) => { };
            OnCreate = (options, context) => null;
        }

        public Func<DataFactoryOptions<T>, IOwinContext, T> OnCreate { get; set; }
        public Action<DataFactoryOptions<T>, T> OnDispose { get; set; }

        public virtual T Create(DataFactoryOptions<T> options, IOwinContext context) {
            return OnCreate(options, context);
        }

        public virtual void Dispose(DataFactoryOptions<T> options, T instance) {
            OnDispose(options, instance);
        }
    }
}
