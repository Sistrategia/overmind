using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Sistrategia.Overmind.Security;
using Microsoft.AspNet.Identity;

namespace Sistrategia.Overmind.Data.EF6Client.AspNetIdentityProvider
{
    public class UserStoreAdapter : IUserStore<IdentityUser, int>
        , IUserPasswordStore<IdentityUser, int>
        , IUserSecurityStampStore<IdentityUser, int>
        , IUserEmailStore<IdentityUser, int>
        , IUserPhoneNumberStore<IdentityUser, int>
        , IUserTwoFactorStore<IdentityUser, int>
        , IUserLockoutStore<IdentityUser, int>

        , IUserLoginStore<IdentityUser, int>
        , IUserClaimStore<IdentityUser, int>
        , IUserRoleStore<IdentityUser, int>

        // , IQueryableUserStore<IdentityUser, int>
    {
        private DataManager dataManager = null;

        public UserStoreAdapter(DataManager dataManager) {
            this.dataManager = dataManager;
        }

        public Task CreateAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task DeleteAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task<IdentityUser> FindByIdAsync(int userId) {
            throw new NotImplementedException();
        }

        public Task<IdentityUser> FindByNameAsync(string userName) {
            throw new NotImplementedException();
        }

        public Task UpdateAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public void Dispose() {
            if (this.dataManager != null)
                this.dataManager.Dispose();
        }

        public Task<string> GetPasswordHashAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task<bool> HasPasswordAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task SetPasswordHashAsync(IdentityUser user, string passwordHash) {
            throw new NotImplementedException();
        }

        public Task<string> GetSecurityStampAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task SetSecurityStampAsync(IdentityUser user, string stamp) {
            throw new NotImplementedException();
        }

        public Task<IdentityUser> FindByEmailAsync(string email) {
            throw new NotImplementedException();
        }

        public Task<string> GetEmailAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task<bool> GetEmailConfirmedAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task SetEmailAsync(IdentityUser user, string email) {
            throw new NotImplementedException();
        }

        public Task SetEmailConfirmedAsync(IdentityUser user, bool confirmed) {
            throw new NotImplementedException();
        }

        public Task<string> GetPhoneNumberAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task<bool> GetPhoneNumberConfirmedAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task SetPhoneNumberAsync(IdentityUser user, string phoneNumber) {
            throw new NotImplementedException();
        }

        public Task SetPhoneNumberConfirmedAsync(IdentityUser user, bool confirmed) {
            throw new NotImplementedException();
        }

        public Task<bool> GetTwoFactorEnabledAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task SetTwoFactorEnabledAsync(IdentityUser user, bool enabled) {
            throw new NotImplementedException();
        }

        public Task<int> GetAccessFailedCountAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task<bool> GetLockoutEnabledAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task<DateTimeOffset> GetLockoutEndDateAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task<int> IncrementAccessFailedCountAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task ResetAccessFailedCountAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task SetLockoutEnabledAsync(IdentityUser user, bool enabled) {
            throw new NotImplementedException();
        }

        public Task SetLockoutEndDateAsync(IdentityUser user, DateTimeOffset lockoutEnd) {
            throw new NotImplementedException();
        }

        public Task AddLoginAsync(IdentityUser user, UserLoginInfo login) {
            throw new NotImplementedException();
        }

        public Task<IdentityUser> FindAsync(UserLoginInfo login) {
            throw new NotImplementedException();
        }

        public Task<IList<UserLoginInfo>> GetLoginsAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task RemoveLoginAsync(IdentityUser user, UserLoginInfo login) {
            throw new NotImplementedException();
        }

        public Task AddClaimAsync(IdentityUser user, System.Security.Claims.Claim claim) {
            throw new NotImplementedException();
        }

        public Task<IList<System.Security.Claims.Claim>> GetClaimsAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task RemoveClaimAsync(IdentityUser user, System.Security.Claims.Claim claim) {
            throw new NotImplementedException();
        }

        public Task AddToRoleAsync(IdentityUser user, string roleName) {
            throw new NotImplementedException();
        }

        public Task<IList<string>> GetRolesAsync(IdentityUser user) {
            throw new NotImplementedException();
        }

        public Task<bool> IsInRoleAsync(IdentityUser user, string roleName) {
            throw new NotImplementedException();
        }

        public Task RemoveFromRoleAsync(IdentityUser user, string roleName) {
            throw new NotImplementedException();
        }
    }
}
