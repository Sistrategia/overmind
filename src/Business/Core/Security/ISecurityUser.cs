using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Sistrategia.Overmind.Security
{
    public interface ISecurityUser
    {
        int UserId { get; }
        Guid PublicKey { get; set; }
        string LoginName { get; set; }
    }
}
