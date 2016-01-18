using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Owin;
using System.Data.Entity;
using Sistrategia.Overmind.Storage;

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

        public DbContext DbContext {
            get { return this.context; }
        }

        public IDbSet<CloudStorageProvider> CloudStorageProviders { get { return this.context.CloudStorageProviders; } }
        // public IDbSet<CloudStorageAccount> CloudStorageAccounts { get { return this.context.CloudStorageAccounts; } }

        public void Dispose() {
            if (this.context!=null)
                this.context.Dispose();            
        }
    }
}
