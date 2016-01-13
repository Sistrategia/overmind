using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Sistrategia.Overmind.Security
{
    public class SecurityUser : ISecurityUser
    {
        public virtual int UserId { get; set; }        
        public Guid PublicKey { get; set; }
        public virtual string LoginName { get; set; }
    }
}
