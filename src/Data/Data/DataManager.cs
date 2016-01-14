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
        private ApplicationDbContext context;
        //public static Func<T> Create { get; set; }
        public static DataManager Create(DataFactoryOptions<DataManager> options, IOwinContext context) {
            return new DataManager(new ApplicationDbContext());
        }

        internal DataManager(ApplicationDbContext context) {
            this.context = context;
        }

        public void Dispose() {
            if (this.context!=null)
                this.context.Dispose();            
        }
    }
}
