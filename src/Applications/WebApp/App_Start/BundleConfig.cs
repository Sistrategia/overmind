using System.Web;
using System.Web.Optimization;

namespace Sistrategia.Overmind.WebApp
{
    public class BundleConfig
    {
        public static void RegisterBundles(BundleCollection bundles) {
            bundles.Add(new ScriptBundle("~/bundles/jquery").Include(
                        "~/Scripts/jquery-{version}.js"));

            bundles.Add(new ScriptBundle("~/bundles/jqueryval").Include(
                        "~/Scripts/jquery.validate*"));

            bundles.Add(new ScriptBundle("~/bundles/modernizr").Include(
                        "~/Scripts/modernizr-*"));
            //bundles.Add(new ScriptBundle("~/bundles/bootstrap").Include(
            //          "~/Scripts/bootstrap.js",
            //          "~/Scripts/respond.js"));
            bundles.Add(new ScriptBundle("~/bundles/bootstrap").Include(
                      "~/Scripts/bootstrap.js"));

            bundles.Add(new StyleBundle("~/Content/css").Include(
                      "~/Content/bootstrap.css"
                      //, "~/Content/Site.css"
                //, "~/Content/site.css"
                      ));

            //bundles.Add(new StyleBundle("~/Content/backstagecss").Include(
            //          "~/Content/backstage.css"
            //          ));

            //bundles.Add(new StyleBundle("~/Content/devcss").Include(
            //           "~/Content/backstage.css"
            //    //"~/Content/dev.css"
            //          ));

            //bundles.Add(new StyleBundle("~/Content/welcome").Include(
            //          "~/Content/welcome-bootstrap.css"
            //    //, "~/Content/site.css"
            //          , "~/Content/Welcome.css"

            //          ));

            BundleTable.EnableOptimizations = true;
        }
    }
}