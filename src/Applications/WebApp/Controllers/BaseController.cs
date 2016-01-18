using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Threading.Tasks;
using Microsoft.Owin.Security;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.Owin;
using Sistrategia.Overmind.Data;
using Sistrategia.Overmind.Security;

namespace Sistrategia.Overmind.WebApp.Controllers
{
    public class BaseController : Controller
    {
        private DataManager dataManager;
        private SecuritySignInManager signInManager;
        private SecurityUserManager userManager;
        //private ApplicationDbContext applicationDBContext;

        public BaseController() {

        }

        public BaseController(DataManager dataManager, SecurityUserManager userManager, SecuritySignInManager signInManager) { //, ApplicationDbContext applicationDBContext) {
            DataManager = dataManager;
            UserManager = userManager;
            SignInManager = signInManager;
            //DBContext = applicationDBContext;
        }

        //public ApplicationDbContext DBContext {
        //    get { return applicationDBContext ?? HttpContext.GetOwinContext().Get<ApplicationDbContext>(); }
        //    private set { applicationDBContext = value; }
        //}
        public DataManager DataManager {
            get { return dataManager ?? HttpContext.GetOwinContext().GetDataManager<DataManager>(); }
            private set { dataManager = value; }
        }

        public SecuritySignInManager SignInManager {
            get { return signInManager ?? HttpContext.GetOwinContext().Get<SecuritySignInManager>(); }
            private set { signInManager = value; }
        }

        public SecurityUserManager UserManager {
            get { return userManager ?? HttpContext.GetOwinContext().GetUserManager<SecurityUserManager>(); }
            private set { userManager = value; }
        }

        public int GetUserId() {
            return User.Identity.GetUserId<int>();
            //return int.Parse(User.Identity.GetUserId());
        }

        public SecurityUser CurrentSecurityUser {
            get {
                var userId = this.GetUserId(); // int.Parse( User.Identity.GetUserId() );
                return UserManager.FindById(userId);
            }
        }

        //protected override HttpNotFoundResult HttpNotFound(string statusDescription) {
        //    return base.HttpNotFound(statusDescription);
        //    Response.StatusCode = 404;
        //    Response.StatusDescription = statusDescription;
        //    return View(Errors);            
        //}


        protected override void Dispose(bool disposing) {
            if (disposing) {
                if (userManager != null) {
                    userManager.Dispose();
                    userManager = null;
                }

                if (signInManager != null) {
                    signInManager.Dispose();
                    signInManager = null;
                }

                //if (applicationDBContext != null) {
                //    applicationDBContext.Dispose();
                //    applicationDBContext = null;
                //}

                if (dataManager != null) {
                    dataManager.Dispose();
                    dataManager = null;
                }
            }
            base.Dispose(disposing);
        }
    }
}