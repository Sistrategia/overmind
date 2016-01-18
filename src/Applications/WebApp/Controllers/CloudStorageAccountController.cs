using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using Sistrategia.Overmind.WebApp.Models;

namespace Sistrategia.Overmind.WebApp.Controllers
{
    [Authorize(Roles = "Developer")]
    public class CloudStorageAccountController : BaseController
    {
        // GET: CloudStorageAccount
        public ActionResult Index()
        {
            var model = new CloudStorageAccountIndexViewModel {
                CloudStorageAccounts = CurrentSecurityUser.CloudStorageAccounts.OrderBy(p => p.Alias).ToList() // DataManager.CloudStorageAccounts.OrderBy(p => p.Alias).ToList()
            };
            return View(model);
        }

        public ActionResult Details(string id) {
            Guid publicKey = Guid.Parse(id);
            var account = CurrentSecurityUser.CloudStorageAccounts.SingleOrDefault(a => a.PublicKey == publicKey);
            var model = new CloudStorageAccountDetailViewModel {
                CloudStorageAccount = account
            };
            return View(model);
        }

        public ActionResult Create() {
            var model = new CloudStorageAccountCreateViewModel {
                CloudStorageProviders = DataManager.CloudStorageProviders.ToList()
                //CloudStorageProviderId = null,
                //AccountName = null,
                //AccountKey
            };
            return View(model);
        }
    }
}