using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using Sistrategia.Overmind.Storage;

namespace Sistrategia.Overmind.WebApp.Models
{
    public class CloudStorageAccountIndexViewModel
    {
        //public string UserName { get; set; }
        public IList<CloudStorageAccount> CloudStorageAccounts { get; set; }
    }

    public class CloudStorageAccountDetailViewModel
    {
        public CloudStorageAccount CloudStorageAccount { get; set; }
    }

    public class CloudStorageAccountCreateViewModel
    {
        public IList<CloudStorageProvider> CloudStorageProviders { get; set; }
        public string CloudStorageProviderId { get; set; }
        public string AccountName { get; set; }
        public string AccountKey { get; set; }
        public string Alias { get; set; }
        public string Description { get; set; }
    }
}