/**************************************************************************
 * Copyright 2015 (c) JEOCSI SA DE CV (Sistrategia) All rights reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ************************************************************************/

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Security.Claims;
using Sistrategia.Overmind.Security;
using Microsoft.AspNet.Identity;


namespace Sistrategia.Overmind.Data.EF6Client.AspNetIdentityProvider
{
    public class IdentityUser : SecurityUser, ISecurityUser, IUser<int>
    {
        public int Id {
            get { return this.UserId; }
            set { this.UserId = value; }
        }

        public string UserName {
            get { return this.LoginName; }
            set { this.LoginName = value; }
        }

        public IdentityUser()
            : base() {
        }

        public IdentityUser(ISecurityUser securityUser)
            : base() {
            if (securityUser == null)
                throw new ArgumentNullException("securityUser");
            this.UserId = securityUser.UserId;
            this.PublicKey = securityUser.PublicKey;
            this.LoginName = securityUser.LoginName;
            //this.FullName = securityUser.FullName;

            //this.Email = securityUser.Email;
            //this.EmailConfirmed = securityUser.EmailConfirmed;
            //this.PasswordHash = securityUser.PasswordHash;
            //this.SecurityStamp = securityUser.SecurityStamp;
            //this.PhoneNumber = securityUser.PhoneNumber;
            //this.PhoneNumberConfirmed = securityUser.PhoneNumberConfirmed;
            //this.TwoFactorEnabled = securityUser.TwoFactorEnabled;
            //this.LockoutEndDateUtc = securityUser.LockoutEndDateUtc;
            //this.LockoutEnabled = securityUser.LockoutEnabled;
            //this.AccessFailedCount = securityUser.AccessFailedCount;
        }

        public async Task<ClaimsIdentity> GenerateUserIdentityAsync(UserManager<IdentityUser, int> manager) {
            // Note the authenticationType must match the one defined in CookieAuthenticationOptions.AuthenticationType
            var userIdentity = await manager.CreateIdentityAsync(this, DefaultAuthenticationTypes.ApplicationCookie);
            // Add custom user claims here
            return userIdentity;
        }
    }
}
