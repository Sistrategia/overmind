using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using Microsoft.WindowsAzure.Storage.Blob;

namespace Sistrategia.Overmind.WebApp.Models
{
    public class CloudStorageItemDetailsViewModel
    {
        public CloudBlob CloudStorageItem { get; set; }
        //public string Url { get; set; }
        //public bool IsImage { get; set; }
        public string ContainerName { get; set; }
        public string AccountId { get; set; }

    }

    public class CloudStorageItemEditViewModel
    {
        public string Name { get; set; }
        public string ContainerName { get; set; }
        public string AccountId { get; set; }

        public string ContentType { get; set; }

        public CloudBlob CloudStorageItem { get; set; }
    }
}