using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Sistrategia.Overmind.Data
{
    public class DataFactoryOptions<T> where T : System.IDisposable
    {
        public DataFactoryOptions() {
        }

        public IDataFactoryProvider<T> Provider { get; set; }
    }
}
