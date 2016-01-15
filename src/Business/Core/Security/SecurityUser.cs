using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNet.Identity.EntityFramework;

namespace Sistrategia.Overmind.Security
{
    public class SecurityUser : IdentityUser<int, SecurityUserLogin, SecurityUserRole, SecurityUserClaim>, ISecurityUser // , Microsoft.AspNet.Identity.IUser<int>
    {
        public SecurityUser()
            : base() {
            this.PublicKey = Guid.NewGuid();
        }

        /// <summary>
        ///     Constructor that takes a userName
        /// </summary>
        /// <param name="userName"></param>
        public SecurityUser(string userName)
            : this() {
            UserName = userName;
        }

        //public virtual int UserId { get; set; }        
        public Guid PublicKey { get; set; }        

        //int Microsoft.AspNet.Identity.IUser<int>.Id {
        //    get { return this.UserId; }
        //}
        //string Microsoft.AspNet.Identity.IUser<int>.UserName {
        //    get {
        //        return this.LoginName;
        //    }
        //    set {
        //        this.LoginName = value;
        //    }
        //}

        public int UserId {
            get { return this.Id; } 
            set { this.Id = value; }
        }

        public string LoginName {
            get { return this.UserName; }
            set { this.UserName = value; }
        }

        //[MaxLength(256)]
        public string FullName { get; set; }
    }
}
