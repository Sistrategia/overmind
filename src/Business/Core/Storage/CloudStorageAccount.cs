using Microsoft.WindowsAzure.Storage.Blob;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Sistrategia.Overmind.Storage
{
    public class CloudStorageAccount
    {
        private List<CloudBlobContainer> cloudStorageContainers = null;
        public CloudStorageAccount() {
            this.PublicKey = Guid.NewGuid();
        //Microsoft.WindowsAzure.Storage

        }

        [Key]
        public int CloudStorageAccountId { get; set; }

        //[Column(Order = 2)]
        [ForeignKey("CloudStorageProvider")]
        public string CloudStorageProviderId { get; set; }
        public virtual CloudStorageProvider CloudStorageProvider { get; set; }

        [Required]
        public Guid PublicKey { get; set; }

        [Required, MaxLength(128)]
        public string ProviderKey { get; set; }

        [MaxLength(512)]
        public string AccountName { get; set; }

        [MaxLength(1024)]
        public string AccountKey { get; set; }

        [MaxLength(256)]
        public string Alias { get; set; }

        public string Description { get; set; }

        ////public virtual IList<SecurityUser> SecurityUsers { get; set; }

        //public virtual IList<CloudStorageContainer> CloudStorageContainers { get; set; }
        
        //[NotMapped]
        //public List<CloudStorageContainer> CloudStorageContainers { get; set; }

        [NotMapped]
        public List<CloudBlobContainer> CloudStorageContainers {
            get {
                if (cloudStorageContainers == null) {

                    Microsoft.WindowsAzure.Storage.CloudStorageAccount storageAccount = //new Microsoft.WindowsAzure.Storage.CloudStorageAccount()
                Microsoft.WindowsAzure.Storage.CloudStorageAccount.Parse(
                    string.Format("DefaultEndpointsProtocol=https;AccountName={0};AccountKey={1};BlobEndpoint=https://{0}.blob.core.windows.net/", this.AccountName, this.AccountKey)
                   );
                    Microsoft.WindowsAzure.Storage.Blob.CloudBlobClient blobClient = storageAccount.CreateCloudBlobClient();
                    var containers = blobClient.ListContainers();

                    cloudStorageContainers = new List<CloudBlobContainer>();

                    foreach (CloudBlobContainer container in containers) {
                        cloudStorageContainers.Add(container);
                    }

                }
                return this.cloudStorageContainers;
            }
            
        }

    }
}
