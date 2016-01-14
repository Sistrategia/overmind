using System;
using System.Configuration;
using System.Threading.Tasks;
using System.Security.Claims;
using Owin;
using Microsoft.AspNet.Identity;
using Microsoft.Owin;
using Microsoft.Owin.Security;
using Microsoft.Owin.Security.Cookies;
using Microsoft.AspNet.Identity.Owin;
using Sistrategia.Overmind.Data.EF6Client.AspNetIdentityProvider;
using Sistrategia.Overmind.Data;


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
                    OnValidateIdentity = SecurityStampValidator.OnValidateIdentity<SecurityUserManager, IdentityUser, int>(
                        validateInterval: TimeSpan.FromMinutes(30), //  5
                        regenerateIdentityCallback: (manager, user) => user.GenerateUserIdentityAsync(manager),
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

    public class SecuritySignInManager : SignInManager<IdentityUser, int>
    {
        public SecuritySignInManager(SecurityUserManager userManager, IAuthenticationManager authenticationManager)
            : base(userManager, authenticationManager) {
        }

        public override Task<ClaimsIdentity> CreateUserIdentityAsync(IdentityUser user) {
            //return user.GenerateUserIdentityAsync((SecurityUserManager)UserManager);
            return user.GenerateUserIdentityAsync((SecurityUserManager)UserManager);
        }

        public static SecuritySignInManager Create(IdentityFactoryOptions<SecuritySignInManager> options, IOwinContext context) {
            return new SecuritySignInManager(context.GetUserManager<SecurityUserManager>(), context.Authentication);
        }
    }

    public class SecurityUserManager : Microsoft.AspNet.Identity.UserManager<IdentityUser, int>
    {
        public SecurityUserManager(Microsoft.AspNet.Identity.IUserStore<IdentityUser, int> store)
            : base(store) {
        }

        public static SecurityUserManager Create(IdentityFactoryOptions<SecurityUserManager> options, IOwinContext context) {
            //var manager = new SecurityUserManager(new UserStore<SecurityUser>(context.Get<ApplicationDbContext>()));
            //var manager = new SecurityUserManager(new UserStore<SecurityUser, SecurityRole, string, IdentityUserLogin, IdentityUserRole, IdentityUserClaim>(context.Get<ApplicationDbContext>()));

            //var store = new UserStoreAdapter(new Security.Data.SqlClient.SqlClientSecurityProvider("DefaultDatabase", 0)); //  IUserStore<IdentityUser, int> store
            var store = new UserStoreAdapter(context.GetDataManager<DataManager>());
            var manager = new SecurityUserManager(store);

            //var manager = new SecurityUserManager(new SecurityUserStore(context.Get<ApplicationDbContext>()));

            // Configure validation logic for usernames
            manager.UserValidator = new UserValidator<IdentityUser, int>(manager) {
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
                    new DataProtectorTokenProvider<IdentityUser, int>(dataProtectionProvider.Create("ASP.NET Identity")); // {
                //  TokenLifespan = TimeSpan.FromHours(3)
                //};
            }

            return manager;
        }
    }
}