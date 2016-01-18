using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using Sistrategia.Overmind.WebApp.Models;

namespace Sistrategia.Overmind.WebApp.Controllers
{
    public class CloudStorageItemController : BaseController
    {
        // GET: CloudStorageItem
        public ActionResult Index()
        {
            return View();
        }

        //public ActionResult Details(string iid, string container, string account) {
        //    var aid = Guid.Parse(account);
        //    //var cid = Guid.Parse(container);
        //    var theAccount = CurrentSecurityUser.CloudStorageAccounts.SingleOrDefault(a => a.PublicKey == aid);

        //    Microsoft.WindowsAzure.Storage.CloudStorageAccount storageAccount = //new Microsoft.WindowsAzure.Storage.CloudStorageAccount()
        //       Microsoft.WindowsAzure.Storage.CloudStorageAccount.Parse(
        //           string.Format("DefaultEndpointsProtocol=https;AccountName={0};AccountKey={1};BlobEndpoint=https://{0}.blob.core.windows.net/", theAccount.AccountName, theAccount.AccountKey)
        //          );
        //    Microsoft.WindowsAzure.Storage.Blob.CloudBlobClient blobClient = storageAccount.CreateCloudBlobClient();
        //    Microsoft.WindowsAzure.Storage.Blob.CloudBlobContainer theContainer = blobClient.GetContainerReference(container);
        //    Microsoft.WindowsAzure.Storage.Blob.CloudBlob blob = theContainer.GetBlobReference(iid);
        //    blob.FetchAttributes();
            

        //    var model = new CloudStorageItemDetailsViewModel {
        //        CloudStorageItem = blob
        //    };

        //    return View(model);
        //}

        public ActionResult Details(string iid, string container, string account) {
            var aid = Guid.Parse(account);
            //var cid = Guid.Parse(container);
            var theAccount = CurrentSecurityUser.CloudStorageAccounts.SingleOrDefault(a => a.PublicKey == aid);

            Microsoft.WindowsAzure.Storage.CloudStorageAccount storageAccount = //new Microsoft.WindowsAzure.Storage.CloudStorageAccount()
               Microsoft.WindowsAzure.Storage.CloudStorageAccount.Parse(
                   string.Format("DefaultEndpointsProtocol=https;AccountName={0};AccountKey={1};BlobEndpoint=https://{0}.blob.core.windows.net/", theAccount.AccountName, theAccount.AccountKey)
                  );
            Microsoft.WindowsAzure.Storage.Blob.CloudBlobClient blobClient = storageAccount.CreateCloudBlobClient();
            Microsoft.WindowsAzure.Storage.Blob.CloudBlobContainer theContainer = blobClient.GetContainerReference(container);
            Microsoft.WindowsAzure.Storage.Blob.CloudBlob blob = theContainer.GetBlobReference(iid);
            blob.FetchAttributes();


            var model = new CloudStorageItemDetailsViewModel {
                CloudStorageItem = blob,
                AccountId = account,
                ContainerName = container
            };

            return View(model);
        }

        public ActionResult Edit(string name, string container, string account) {
            var aid = Guid.Parse(account);
            //var cid = Guid.Parse(container);
            var theAccount = CurrentSecurityUser.CloudStorageAccounts.SingleOrDefault(a => a.PublicKey == aid);

            Microsoft.WindowsAzure.Storage.CloudStorageAccount storageAccount = //new Microsoft.WindowsAzure.Storage.CloudStorageAccount()
               Microsoft.WindowsAzure.Storage.CloudStorageAccount.Parse(
                   string.Format("DefaultEndpointsProtocol=https;AccountName={0};AccountKey={1};BlobEndpoint=https://{0}.blob.core.windows.net/", theAccount.AccountName, theAccount.AccountKey)
                  );
            Microsoft.WindowsAzure.Storage.Blob.CloudBlobClient blobClient = storageAccount.CreateCloudBlobClient();
            Microsoft.WindowsAzure.Storage.Blob.CloudBlobContainer theContainer = blobClient.GetContainerReference(container);
            Microsoft.WindowsAzure.Storage.Blob.CloudBlob blob = theContainer.GetBlobReference(name);
            blob.FetchAttributes();


            var model = new CloudStorageItemEditViewModel {
                AccountId = account,
                ContainerName = container,
                Name = name,
                ContentType = blob.Properties.ContentType,
                CloudStorageItem = blob
            };

            return View(model);
        }

        [HttpPost]
        public ActionResult Edit(CloudStorageItemEditViewModel model) {
            var aid = Guid.Parse(model.AccountId);
            //var cid = Guid.Parse(container);
            var theAccount = CurrentSecurityUser.CloudStorageAccounts.SingleOrDefault(a => a.PublicKey == aid);

            Microsoft.WindowsAzure.Storage.CloudStorageAccount storageAccount = //new Microsoft.WindowsAzure.Storage.CloudStorageAccount()
               Microsoft.WindowsAzure.Storage.CloudStorageAccount.Parse(
                   string.Format("DefaultEndpointsProtocol=https;AccountName={0};AccountKey={1};BlobEndpoint=https://{0}.blob.core.windows.net/", theAccount.AccountName, theAccount.AccountKey)
                  );
            Microsoft.WindowsAzure.Storage.Blob.CloudBlobClient blobClient = storageAccount.CreateCloudBlobClient();
            Microsoft.WindowsAzure.Storage.Blob.CloudBlobContainer theContainer = blobClient.GetContainerReference(model.ContainerName);
            Microsoft.WindowsAzure.Storage.Blob.CloudBlob blob = theContainer.GetBlobReference(model.Name);
            blob.FetchAttributes();

            if (!string.IsNullOrEmpty(model.ContentType)) {
                if (!blob.Properties.ContentType.Equals(model.ContentType)) {
                    blob.Properties.ContentType = model.ContentType;
                }
            }

            blob.SetProperties();

            return View(model);
        }
    }
}