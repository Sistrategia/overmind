using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Sistrategia.Overmind.Security;
using Microsoft.AspNet.Identity.EntityFramework;
using System.Data.Entity.Infrastructure.Annotations;
using System.ComponentModel.DataAnnotations.Schema;
using Sistrategia.Overmind.Storage;

namespace Sistrategia.Overmind.Data
{
    internal class ApplicationDbContext // : DbContext
         : IdentityDbContext<SecurityUser, SecurityRole
        , int, SecurityUserLogin, SecurityUserRole, SecurityUserClaim>
    {
        public ApplicationDbContext()
            : base("DefaultDatabase") {
        }

        public static ApplicationDbContext Create() {
            return new ApplicationDbContext();
        }

        public virtual DbSet<CloudStorageProvider> CloudStorageProviders { get; set; }
        //public virtual DbSet<CloudStorageAccount> CloudStorageAccounts { get; set; }

        protected override void OnModelCreating(System.Data.Entity.DbModelBuilder modelBuilder) {
            var user = modelBuilder.Entity<SecurityUser>()
                .ToTable("security_user");
            user.Property(u => u.Id).HasColumnName("user_id")
                .HasColumnOrder(1);
            user.Ignore(u => u.UserId);            
            //user.HasMany(u => u.Roles).WithRequired().HasForeignKey(ur => ur.UserId);
            user.HasMany(u => u.Claims).WithRequired().HasForeignKey(uc => uc.UserId);
            user.HasMany(u => u.Logins).WithRequired().HasForeignKey(ul => ul.UserId);
            user.Property(u => u.UserName)
                .HasColumnName("user_name")
                .IsRequired()
                .HasMaxLength(256)
                .HasColumnOrder(2)
                .HasColumnAnnotation("Index", new IndexAnnotation(new IndexAttribute("ix_user_name_index") { IsUnique = true }));

            user.Property(p => p.PublicKey)
                .HasColumnName("public_key")
                .HasColumnAnnotation("Index", new IndexAnnotation(new IndexAttribute("ix_user_public_key_index") { IsUnique = true }));

            user.Property(p => p.FullName)
                .HasColumnName("full_name")
                .HasMaxLength(256)
                .HasColumnAnnotation("Index", new IndexAnnotation(new IndexAttribute("ix_user_full_name_index") { IsUnique = false }));

            user.Property(u => u.Email)
                .HasColumnName("email")
                .HasMaxLength(256);
            user.Property(u => u.EmailConfirmed)
                .HasColumnName("email_confirmed");
            user.Property(u => u.PasswordHash)
                .HasColumnName("password_hash");
            user.Property(u => u.SecurityStamp)
                .HasColumnName("security_stamp");
            user.Property(u => u.PhoneNumber)
                .HasColumnName("phone_number");
            user.Property(u => u.PhoneNumberConfirmed)
                .HasColumnName("phone_number_confirmed");
            user.Property(u => u.TwoFactorEnabled)
                .HasColumnName("two_factor_enabled");
            user.Property(u => u.LockoutEndDateUtc)
                .HasColumnName("lockout_end_date_utc");
            user.Property(u => u.LockoutEnabled)
                .HasColumnName("lockout_enabled");
            user.Property(u => u.AccessFailedCount)
                .HasColumnName("access_failed_count");            

            var role = modelBuilder.Entity<SecurityRole>()
               .ToTable("security_roles");
            role.Property(r => r.Id).HasColumnName("role_id");
            role.Property(r => r.Name)
                .HasColumnName("role_name")
                .IsRequired()
                .HasMaxLength(256)
                .HasColumnAnnotation("Index", new IndexAnnotation(new IndexAttribute("ix_role_name_index") { IsUnique = true }));

            role.HasMany(r => r.Users).WithRequired().HasForeignKey(ur => ur.RoleId);            

            user.HasMany(u => u.Roles).WithRequired().HasForeignKey(ur => ur.UserId);            

            var userRole = modelBuilder.Entity<SecurityUserRole>()
                .HasKey(r => new { r.UserId, r.RoleId })
                .ToTable("security_user_roles")
                //.Property(pr1 => pr1.RoleId).HasColumnName("role_id");                
                ;
            userRole.Property(pr1 => pr1.RoleId).HasColumnName("role_id");
            userRole.Property(pr2 => pr2.UserId).HasColumnName("user_id");


            var userLogin = modelBuilder.Entity<SecurityUserLogin>()
                 .HasKey(l => new { l.LoginProvider, l.ProviderKey, l.UserId })
                 .ToTable("security_user_logins");
            userLogin.Property(pr1 => pr1.LoginProvider).HasColumnName("login_provider");
            userLogin.Property(pr2 => pr2.ProviderKey).HasColumnName("provider_key");
            userLogin.Property(pr3 => pr3.UserId).HasColumnName("user_id");

            var userClaim = modelBuilder.Entity<SecurityUserClaim>()
                .ToTable("security_user_claims");
            userClaim.Property(pr1 => pr1.Id).HasColumnName("claim_id");
            userClaim.Property(pr2 => pr2.UserId).HasColumnName("user_id");
            userClaim.Property(pr3 => pr3.ClaimType).HasColumnName("claim_type");
            userClaim.Property(pr4 => pr4.ClaimValue).HasColumnName("claim_value");




            var cloudStorageProvider = modelBuilder.Entity<CloudStorageProvider>()
                .ToTable("cloud_storage_provider");
            cloudStorageProvider.Property(p => p.CloudStorageProviderId)
                .HasColumnName("cloud_storage_provider_id");
            cloudStorageProvider.Property(p => p.Name)
                .HasColumnName("name");
            cloudStorageProvider.Property(p => p.Description)
                .HasColumnName("description");

            var cloudStorageAccount = modelBuilder.Entity<CloudStorageAccount>()
                .ToTable("cloud_storage_account");
            cloudStorageAccount.Property(p => p.CloudStorageAccountId)
                .HasColumnName("cloud_storage_account_id")
                //.HasColumnOrder(1)
                ;

            cloudStorageAccount.Property(p => p.CloudStorageProviderId)
                .HasColumnName("cloud_storage_provider_id")
                ;
            //cloudStorageAccount.HasRequired<CloudStorageProvider>(a => a.CloudStorageProvider)
            //    .WithMany().Map(p => p.MapKey("cloud_storage_provider_id"));

            // If you want to control all mapping here without DataAnnotations on Model Classes use this:
            //cloudStorageAccount.Property(p => p.CloudStorageProviderId)
            //    .HasColumnName("cloud_storage_provider_id")//.HasColumnOrder(2)                
            //    ;
            //cloudStorageAccount.HasRequired<CloudStorageProvider>(a => a.CloudStorageProvider)
            //    .WithMany().HasForeignKey(f => f.CloudStorageProviderId).WillCascadeOnDelete(false);

            cloudStorageAccount.Property(p => p.PublicKey)
                .HasColumnName("public_key")
                .HasColumnAnnotation("Index", new IndexAnnotation(new IndexAttribute()));

            cloudStorageAccount.Property(p => p.ProviderKey)
                .HasColumnName("provider_key");

            cloudStorageAccount.Property(p => p.AccountName)
                .HasColumnName("account_name");

            cloudStorageAccount.Property(p => p.Alias)
                .HasColumnName("alias");
            cloudStorageAccount.Property(p => p.Description)
                .HasColumnName("description");

            cloudStorageAccount.Property(p => p.AccountKey)
                .HasColumnName("account_key");


            modelBuilder.Entity<SecurityUser>()
                .HasMany(u => u.CloudStorageAccounts)
                .WithMany()               
                .Map(t => t.MapLeftKey("user_id") // security_user_id
                .MapRightKey("cloud_storage_account_id")
                .ToTable("security_user_cloud_storage_account"))
                ;


        }
    }
}
