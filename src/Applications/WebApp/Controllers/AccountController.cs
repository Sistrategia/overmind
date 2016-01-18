using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.Owin;
using System.Threading.Tasks;

using Sistrategia.Overmind.WebApp.Models;
using Microsoft.Owin.Security;

namespace Sistrategia.Overmind.WebApp.Controllers
{
    [Authorize]
    public class AccountController : Controller
    {
      
        private SecuritySignInManager signInManager;
        private SecurityUserManager userManager;

        public AccountController() {
        }

        public AccountController(SecurityUserManager userManager, SecuritySignInManager signInManager) {
            UserManager = userManager;
            SignInManager = signInManager;
        }

        public SecuritySignInManager SignInManager {
            get { return signInManager ?? HttpContext.GetOwinContext().Get<SecuritySignInManager>(); }
            private set { signInManager = value; }
        }

        public SecurityUserManager UserManager {
            get { return userManager ?? HttpContext.GetOwinContext().GetUserManager<SecurityUserManager>(); }
            private set { userManager = value; }
        }


        //// GET: Account
        //public ActionResult Index()
        //{
        //    return View();
        //}

        #region Login and Logoff
        //
        // GET: /Account/Login
        [AllowAnonymous]
        public ActionResult Login(string returnUrl) {
            ViewBag.ReturnUrl = returnUrl;
            return View();
        }

        //
        // POST: /Account/Login
        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<ActionResult> Login(LoginViewModel model, string returnUrl) {
            if (!ModelState.IsValid) {
                return View(model);
            }

            if (!model.Email.EndsWith("@sistrategia.com"))
                return View("AccountManualValidation");

            var result = await SignInManager.PasswordSignInAsync(model.Email, model.Password, model.RememberMe, shouldLockout: true);
            switch (result) {
                case SignInStatus.Success:
                    return RedirectToLocal(returnUrl);
                case SignInStatus.LockedOut:
                    return View("Lockout");
                case SignInStatus.RequiresVerification:
                    return RedirectToAction("SendCode", new { ReturnUrl = returnUrl, RememberMe = model.RememberMe });
                case SignInStatus.Failure:
                default:
                    ModelState.AddModelError("", "Invalid login attempt.");
                    return View(model);
            }
        }

        //[HttpPost]
        //[ValidateAntiForgeryToken]
        public ActionResult LogOff() {
            AuthenticationManager.SignOut();
            return RedirectToAction("Index", "Home");
        }

        #endregion


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
            }
            base.Dispose(disposing);
        }


        #region Helpers
        // Used for XSRF protection when adding external logins
        private const string XsrfKey = "XsrfId";

        private IAuthenticationManager AuthenticationManager {
            get {
                return HttpContext.GetOwinContext().Authentication;
            }
        }

        private void AddErrors(IdentityResult result) {
            foreach (var error in result.Errors) {
                ModelState.AddModelError("", error);
            }
        }

        private ActionResult RedirectToLocal(string returnUrl) {
            if (Url.IsLocalUrl(returnUrl)) {
                return Redirect(returnUrl);
            }
            return RedirectToAction("Index", "Home");
        }

        internal class ChallengeResult : HttpUnauthorizedResult
        {
            public ChallengeResult(string provider, string redirectUri)
                : this(provider, redirectUri, null) {
            }

            public ChallengeResult(string provider, string redirectUri, string userId) {
                LoginProvider = provider;
                RedirectUri = redirectUri;
                UserId = userId;
            }

            public string LoginProvider { get; set; }
            public string RedirectUri { get; set; }
            public string UserId { get; set; }

            public override void ExecuteResult(ControllerContext context) {
                var properties = new AuthenticationProperties { RedirectUri = RedirectUri };
                if (UserId != null) {
                    properties.Dictionary[XsrfKey] = UserId;
                }
                context.HttpContext.GetOwinContext().Authentication.Challenge(properties, LoginProvider);
            }
        }



        private bool HasPassword() {
            var user = UserManager.FindById(User.Identity.GetUserId<int>()); //this.GetUserId());
            if (user != null) {
                return user.PasswordHash != null;
            }
            return false;
        }

        private bool HasPhoneNumber() {
            var user = UserManager.FindById(User.Identity.GetUserId<int>()); //this.GetUserId());
            if (user != null) {
                return user.PhoneNumber != null;
            }
            return false;
        }

        #endregion
    }




}