using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using Microsoft.WindowsAzure.Storage.Blob;
using Sistrategia.Overmind.Storage;

namespace Sistrategia.Overmind.WebApp.Models
{
    public class CloudStorageContainerDetailsViewModel
    {
        public CloudStorageAccount CloudStorageAccount { get; set; }
        // public CloudStorageContainer CloudStorageContainer { get; set; }
        public CloudBlobContainer CloudStorageContainer { get; set; }
    }
}