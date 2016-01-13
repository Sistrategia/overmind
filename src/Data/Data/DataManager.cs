using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Owin;

namespace Sistrategia.Overmind.Data
{
    public class DataManager : IDisposable
    {
        //public static Func<T> Create { get; set; }
        public static DataManager Create(DataFactoryOptions<DataManager> options, IOwinContext context) {
            throw new NotImplementedException();
        }

        public void Dispose() {
            throw new NotImplementedException();
        }
    }
}
