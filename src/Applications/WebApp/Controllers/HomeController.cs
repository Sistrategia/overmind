using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace Sistrategia.Overmind.WebApp.Controllers
{
    [Authorize]
    public class HomeController : Controller
    {
        [AllowAnonymous]
        public ActionResult Index() {
            if (!User.Identity.IsAuthenticated)
                return RedirectToAction("Welcome");

            return View();
        }

        [AllowAnonymous]
        public ActionResult Welcome() {
            return View();
        }
    }
}