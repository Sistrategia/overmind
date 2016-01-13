using System;
using Microsoft.Owin;

namespace Sistrategia.Overmind.Data
{
    public interface IDataFactoryProvider<T> where T : System.IDisposable
    {
        T Create(DataFactoryOptions<T> options, IOwinContext context);
        void Dispose(DataFactoryOptions<T> options, T instance);
    }
}
