using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNet.Identity.EntityFramework;

namespace Sistrategia.Overmind.Security
{
    public class SecurityRole : IdentityRole<int, SecurityUserRole>
    {
        public SecurityRole() { }
        public SecurityRole(string name) { Name = name; }
    }
}
