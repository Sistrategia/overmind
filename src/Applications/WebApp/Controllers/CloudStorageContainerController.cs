using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using Sistrategia.Overmind.WebApp.Models;

namespace Sistrategia.Overmind.WebApp.Controllers
{
    public class CloudStorageContainerController : BaseController
    {
        // GET: CloudStorageContainer
        public ActionResult Index()
        {
            return View();
        }

        public ActionResult Details(string id, string account) {
            var cid = Guid.Parse(account);
            var theAccount = CurrentSecurityUser.CloudStorageAccounts.SingleOrDefault(a => a.PublicKey == cid);

            Microsoft.WindowsAzure.Storage.CloudStorageAccount storageAccount = //new Microsoft.WindowsAzure.Storage.CloudStorageAccount()
               Microsoft.WindowsAzure.Storage.CloudStorageAccount.Parse(
                   string.Format("DefaultEndpointsProtocol=https;AccountName={0};AccountKey={1};BlobEndpoint=https://{0}.blob.core.windows.net/", theAccount.AccountName, theAccount.AccountKey)
                  );
            Microsoft.WindowsAzure.Storage.Blob.CloudBlobClient blobClient = storageAccount.CreateCloudBlobClient();
            Microsoft.WindowsAzure.Storage.Blob.CloudBlobContainer container = blobClient.GetContainerReference(id);


            var model = new CloudStorageContainerDetailsViewModel {
                CloudStorageContainer = container,
                CloudStorageAccount = theAccount
            };

            return View(model);
        }
    }
}