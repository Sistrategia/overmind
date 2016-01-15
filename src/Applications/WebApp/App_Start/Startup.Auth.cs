using System;
using System.Configuration;
using System.Threading.Tasks;
using System.Security.Claims;
using Owin;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.EntityFramework;
using Microsoft.Owin;
using Microsoft.Owin.Security;
using Microsoft.Owin.Security.Cookies;
using Microsoft.AspNet.Identity.Owin;
using Sistrategia.Overmind.Data;
using Sistrategia.Overmind.Security;
using System.Data.Entity;


namespace Sistrategia.Overmind.WebApp
{
    public partial class Startup
    {
        public void ConfigureAuth(IAppBuilder app) {            
            app.CreatePerOwinContext<SecurityUserManager>(SecurityUserManager.Create);
            app.CreatePerOwinContext<SecuritySignInManager>(SecuritySignInManager.Create);

            app.UseCookieAuthentication(new CookieAuthenticationOptions {
                AuthenticationType = DefaultAuthenticationTypes.ApplicationCookie,
                LoginPath = new PathString("/Account/Login"),
                Provider = new CookieAuthenticationProvider {
                    OnValidateIdentity = SecurityStampValidator.OnValidateIdentity<SecurityUserManager, SecurityUser, int>(
                        validateInterval: TimeSpan.FromMinutes(30), //  5
                        regenerateIdentityCallback: (manager, user) => manager.GenerateUserIdentityAsync(manager, user),
                        getUserIdCallback: (id) => id.GetUserId<int>()
                    )
                }
            });

            app.UseExternalSignInCookie(DefaultAuthenticationTypes.ExternalCookie);

            //app.UseGoogleAuthentication(new GoogleOAuth2AuthenticationOptions() {
            //    ClientId = ConfigurationManager.AppSettings["GoogleClientId"],
            //    ClientSecret = ConfigurationManager.AppSettings["GoogleClientSecret"]
            //});
        }
    }

    public class SecuritySignInManager : SignInManager<SecurityUser, int> // SignInManager<IdentityUser, int>
    {
        public SecuritySignInManager(SecurityUserManager userManager, IAuthenticationManager authenticationManager)
            : base(userManager, authenticationManager) {
        }        

        public static SecuritySignInManager Create(IdentityFactoryOptions<SecuritySignInManager> options, IOwinContext context) {
            return new SecuritySignInManager(context.GetUserManager<SecurityUserManager>(), context.Authentication);
        }
    }

    public class SecurityUserManager : UserManager<SecurityUser, int>  //IdentityUser, int>
    {
        public SecurityUserManager(IUserStore<SecurityUser, int> store) //IdentityUser, int> store)
            : base(store) {
        }

        public async Task<ClaimsIdentity> GenerateUserIdentityAsync(SecurityUserManager manager, SecurityUser user) {
            // Note the authenticationType must match the one defined in CookieAuthenticationOptions.AuthenticationType
            var userIdentity = await manager.CreateIdentityAsync(user, DefaultAuthenticationTypes.ApplicationCookie);
            // Add custom user claims here
            return userIdentity;
        }

        public static SecurityUserManager Create(IdentityFactoryOptions<SecurityUserManager> options, IOwinContext context) {
            //var manager = new SecurityUserManager(new UserStore<SecurityUser>(context.Get<ApplicationDbContext>()));            
            //var manager = new SecurityUserManager(new UserStore<SecurityUser>(context.Get<ApplicationDbContext>()));
            //var manager = new SecurityUserManager(new UserStore<SecurityUser, SecurityRole, string, IdentityUserLogin, IdentityUserRole, IdentityUserClaim>(context.Get<ApplicationDbContext>()));

            //var store = new UserStoreAdapter(new Security.Data.SqlClient.SqlClientSecurityProvider("DefaultDatabase", 0)); //  IUserStore<IdentityUser, int> store
            //var store = new UserStoreAdapter(context.GetDataManager<DataManager>());
            //var manager = new SecurityUserManager(store);

            //var manager = new SecurityUserManager(new SecurityUserStore(context.Get<ApplicationDbContext>()));

            var manager = new SecurityUserManager(new SecurityUserStore(context.GetDataManager<DataManager>().DbContext)); //  new SecurityUserStore(new DataManager().DbContext));// ApplicationDbContext()));

            // Configure validation logic for usernames
            manager.UserValidator = new UserValidator<SecurityUser, int>(manager) {
                AllowOnlyAlphanumericUserNames = false,
                RequireUniqueEmail = true
            };

            // Configure validation logic for passwords
            manager.PasswordValidator = new PasswordValidator {
                RequiredLength = 6,
                RequireNonLetterOrDigit = false, //true,
                RequireDigit = true,
                RequireLowercase = true,
                RequireUppercase = true,
            };

            // Configure user lockout defaults
            manager.UserLockoutEnabledByDefault = true;
            manager.DefaultAccountLockoutTimeSpan = TimeSpan.FromMinutes(5);
            manager.MaxFailedAccessAttemptsBeforeLockout = 5;

            //// Register two factor authentication providers. This application uses Phone and Emails as a step of receiving a code for verifying the user
            //// You can write your own provider and plug it in here.
            ////manager.RegisterTwoFactorProvider("Phone Code", new PhoneNumberTokenProvider<SecurityUser, int> {
            ////    MessageFormat = "Your security code is {0}"
            ////});
            //manager.RegisterTwoFactorProvider("Email Code", new EmailTokenProvider<SecurityUser, int> {
            //    Subject = "Security Code",
            //    BodyFormat = "Your security code is {0}"
            //});

            //manager.EmailService = new EmailService();
            ////manager.SmsService = new SmsService();

            var dataProtectionProvider = options.DataProtectionProvider;
            if (dataProtectionProvider != null) {
                manager.UserTokenProvider =
                    new DataProtectorTokenProvider<SecurityUser, int>(dataProtectionProvider.Create("ASP.NET Identity")); // {
                //  TokenLifespan = TimeSpan.FromHours(3)
                //};
            }

            return manager;
        }

       
    }

    public class SecurityUserStore : UserStore<SecurityUser, SecurityRole, int, SecurityUserLogin, SecurityUserRole, SecurityUserClaim>
    {
        public SecurityUserStore(DbContext context)
            : base(context) {
        }
    }

    //public class SecurityUserStore : UserStore<SecurityUser, SecurityRole, int, SecurityUserLogin, SecurityUserRole, SecurityUserClaim>
    //{
    //    public SecurityUserStore(ApplicationDbContext context)
    //        : base(context) {
    //    }
    //}
}