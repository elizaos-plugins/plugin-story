// src/actions/registerIP.ts
import {
  composeContext,
  elizaLogger,
  generateObjectDeprecated,
  ModelClass
} from "@elizaos/core";
import pinataSDK from "@pinata/sdk";
import { createHash } from "node:crypto";

// src/functions/uploadJSONToIPFS.ts
async function uploadJSONToIPFS(pinata, jsonMetadata) {
  const { IpfsHash } = await pinata.pinJSONToIPFS(jsonMetadata);
  return IpfsHash;
}

// src/providers/wallet.ts
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits
} from "viem";
import { storyOdyssey } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { StoryClient } from "@story-protocol/core-sdk";
var DEFAULT_CHAIN_CONFIGS = {
  odyssey: {
    chainId: 1516,
    name: "Odyssey Testnet",
    chain: storyOdyssey,
    rpcUrl: "https://odyssey.storyrpc.io/",
    nativeCurrency: {
      name: "IP",
      symbol: "IP",
      decimals: 18
    },
    blockExplorerUrl: "https://odyssey.storyscan.xyz"
  }
};
var WalletProvider = class {
  storyClient;
  publicClient;
  walletClient;
  address;
  runtime;
  constructor(runtime) {
    const privateKey = runtime.getSetting("STORY_PRIVATE_KEY");
    if (!privateKey) throw new Error("STORY_PRIVATE_KEY not configured");
    this.runtime = runtime;
    const account = privateKeyToAccount(privateKey);
    this.address = account.address;
    const config = {
      account,
      transport: http(DEFAULT_CHAIN_CONFIGS.odyssey.rpcUrl),
      chainId: "odyssey"
    };
    this.storyClient = StoryClient.newClient(config);
    const baseConfig = {
      chain: storyOdyssey,
      transport: http(DEFAULT_CHAIN_CONFIGS.odyssey.rpcUrl)
    };
    this.publicClient = createPublicClient(
      baseConfig
    );
    this.walletClient = createWalletClient({
      chain: storyOdyssey,
      transport: http(DEFAULT_CHAIN_CONFIGS.odyssey.rpcUrl),
      account
    });
  }
  getAddress() {
    return this.address;
  }
  async getWalletBalance() {
    try {
      const balance = await this.publicClient.getBalance({
        address: this.address
      });
      return formatUnits(balance, 18);
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      return null;
    }
  }
  async connect() {
    return this.runtime.getSetting("STORY_PRIVATE_KEY");
  }
  getPublicClient() {
    return this.publicClient;
  }
  getWalletClient() {
    if (!this.walletClient) throw new Error("Wallet not connected");
    return this.walletClient;
  }
  getStoryClient() {
    if (!this.storyClient) throw new Error("StoryClient not connected");
    return this.storyClient;
  }
};
var storyWalletProvider = {
  async get(runtime, _message, _state) {
    if (!runtime.getSetting("STORY_PRIVATE_KEY")) {
      return null;
    }
    try {
      const walletProvider = new WalletProvider(runtime);
      const address = walletProvider.getAddress();
      const balance = await walletProvider.getWalletBalance();
      return `Story Wallet Address: ${address}
Balance: ${balance} IP`;
    } catch (error) {
      console.error("Error in Story wallet provider:", error);
      return null;
    }
  }
};

// src/templates/index.ts
var registerIPTemplate = `Given the recent messages below:

{{recentMessages}}

Extract the following information about the requested IP registration:
- Field "title": The title of your IP
- Field "description": The description of your IP
- Field "ipType": The type of your IP. Type of the IP Asset, can be defined arbitrarily by the
creator. I.e. \u201Ccharacter\u201D, \u201Cchapter\u201D, \u201Clocation\u201D, \u201Citems\u201D, "music", etc. If a user doesn't provide
an ipType, you can infer it from the title and description. It should be one word.

Respond with a JSON markdown block containing only the extracted values. A user must explicitly provide a title and description.

\`\`\`json
{
    "title": string,
    "description": string,
    "ipType": string
}
\`\`\`
`;
var licenseIPTemplate = `Given the recent messages below:

{{recentMessages}}

Extract the following information about the requested IP licensing:
- Field "licensorIpId": The IP Asset that you want to mint a license from
- Field "licenseTermsId": The license terms that you want to mint a license for
- Field "amount": The amount of licenses to mint

Respond with a JSON markdown block containing only the extracted values. A user must explicitly provide a licensorIpId and licenseTermsId.
If they don't provide the amount, set it as null.

\`\`\`json
{
    "licensorIpId": string,
    "licenseTermsId": string,
    "amount": number | null
}
\`\`\`
`;
var getAvailableLicensesTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested IP licensing:
- Field "ipid": The IP Asset that you want to mint a license from

Respond with a JSON markdown block containing only the extracted values. A user must provide an ipId.

\`\`\`json
{
    "ipid": string
}
\`\`\`
`;
var getIPDetailsTemplate = `Given the recent messages below:

{{recentMessages}}

Extract the following information about the requested IP details:
- Field "ipId": The IP Asset that you want to get details for

Respond with a JSON markdown block containing only the extracted values. A user must provide an ipId.

\`\`\`json
{
    "ipId": string
}
\`\`\`
`;
var attachTermsTemplate = `Given the recent messages below:

{{recentMessages}}

Extract the following information about attaching license terms to an IP Asset:
- Field "ipId": The IP Asset that you want to attach the license terms to
- Field "mintingFee": The fee to mint this license from the IP Asset.
- Field "commercialUse": Whether or not the IP Asset can be used commercially.
- Field "commercialRevShare": The percentage of revenue that the IP Asset owner will receive
from commercial use of the IP Asset. This must be between 0 and 100. If a user specifies
a commercialRevShare, then commercialUse must be set to true.

Respond with a JSON markdown block containing only the extracted values. A user must provide an ipId. If they don't provide
the others fields, set them as null.

\`\`\`json
{
    "ipId": string,
    "mintingFee": number | null,
    "commercialUse": boolean | null,
    "commercialRevShare": number | null
}
\`\`\`
`;

// src/actions/registerIP.ts
var RegisterIPAction = class {
  constructor(walletProvider) {
    this.walletProvider = walletProvider;
  }
  async registerIP(params, runtime) {
    const storyClient = this.walletProvider.getStoryClient();
    const ipMetadata = storyClient.ipAsset.generateIpMetadata({
      title: params.title,
      description: params.description,
      ipType: params.ipType ? params.ipType : void 0
    });
    const nftMetadata = {
      name: params.title,
      description: params.description
    };
    const pinataJWT = runtime.getSetting("PINATA_JWT");
    if (!pinataJWT) throw new Error("PINATA_JWT not configured");
    const pinata = new pinataSDK({ pinataJWTKey: pinataJWT });
    const ipIpfsHash = await uploadJSONToIPFS(pinata, ipMetadata);
    const ipHash = createHash("sha256").update(JSON.stringify(ipMetadata)).digest("hex");
    const nftIpfsHash = await uploadJSONToIPFS(pinata, nftMetadata);
    const nftHash = createHash("sha256").update(JSON.stringify(nftMetadata)).digest("hex");
    const response = await storyClient.ipAsset.mintAndRegisterIpAssetWithPilTerms({
      spgNftContract: "0xC81B2cbEFD1aA0227bf513729580d3CF40fd61dF",
      terms: [],
      ipMetadata: {
        ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
        ipMetadataHash: `0x${ipHash}`,
        nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
        nftMetadataHash: `0x${nftHash}`
      },
      txOptions: { waitForTransaction: true }
    });
    return response;
  }
};
var registerIPAction = {
  name: "REGISTER_IP",
  description: "Register an NFT as an IP Asset on Story",
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger.log("Starting REGISTER_IP handler...");
    let currentState = state;
    if (!currentState) {
      currentState = await runtime.composeState(message);
    } else {
      currentState = await runtime.updateRecentMessageState(currentState);
    }
    const registerIPContext = composeContext({
      state: currentState,
      template: registerIPTemplate
    });
    const content = await generateObjectDeprecated({
      runtime,
      context: registerIPContext,
      modelClass: ModelClass.SMALL
    });
    const walletProvider = new WalletProvider(runtime);
    const action = new RegisterIPAction(walletProvider);
    try {
      const response = await action.registerIP(content, runtime);
      callback?.({
        text: `Successfully registered IP ID: ${response.ipId}. Transaction Hash: ${response.txHash}. View it on the explorer: https://explorer.story.foundation/ipa/${response.ipId}`
      });
      return true;
    } catch (e) {
      elizaLogger.error("Error registering IP:", e.message);
      callback?.({ text: `Error registering IP: ${e.message}` });
      return false;
    }
  },
  template: registerIPTemplate,
  validate: async (runtime) => {
    const privateKey = runtime.getSetting("STORY_PRIVATE_KEY");
    return typeof privateKey === "string" && privateKey.startsWith("0x");
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "I would like to register my IP."
        }
      },
      {
        user: "{{user2}}",
        content: {
          text: "Sure! Please provide the title and description of your IP.",
          action: "REGISTER_IP"
        }
      },
      {
        user: "{{user1}}",
        content: {
          text: "Register my IP titled 'My IP' with the description 'This is my IP'"
        }
      }
    ]
  ],
  similes: ["REGISTER_IP", "REGISTER_NFT"]
};

// src/actions/licenseIP.ts
import {
  composeContext as composeContext2,
  elizaLogger as elizaLogger2,
  generateObjectDeprecated as generateObjectDeprecated2,
  ModelClass as ModelClass2
} from "@elizaos/core";

// src/queries.ts
var licenseRegistryAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "licensingModule",
        internalType: "address",
        type: "address"
      },
      { name: "disputeModule", internalType: "address", type: "address" },
      { name: "ipGraphAcl", internalType: "address", type: "address" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "error",
    inputs: [
      { name: "authority", internalType: "address", type: "address" }
    ],
    name: "AccessManagedInvalidAuthority"
  },
  {
    type: "error",
    inputs: [
      { name: "caller", internalType: "address", type: "address" },
      { name: "delay", internalType: "uint32", type: "uint32" }
    ],
    name: "AccessManagedRequiredDelay"
  },
  {
    type: "error",
    inputs: [{ name: "caller", internalType: "address", type: "address" }],
    name: "AccessManagedUnauthorized"
  },
  {
    type: "error",
    inputs: [{ name: "target", internalType: "address", type: "address" }],
    name: "AddressEmptyCode"
  },
  {
    type: "error",
    inputs: [
      {
        name: "implementation",
        internalType: "address",
        type: "address"
      }
    ],
    name: "ERC1967InvalidImplementation"
  },
  { type: "error", inputs: [], name: "ERC1967NonPayable" },
  { type: "error", inputs: [], name: "FailedInnerCall" },
  { type: "error", inputs: [], name: "InvalidInitialization" },
  {
    type: "error",
    inputs: [
      { name: "childIpId", internalType: "address", type: "address" },
      {
        name: "parentIpIds",
        internalType: "address[]",
        type: "address[]"
      }
    ],
    name: "LicenseRegistry__AddParentIpToIPGraphFailed"
  },
  {
    type: "error",
    inputs: [],
    name: "LicenseRegistry__CallerNotLicensingModule"
  },
  {
    type: "error",
    inputs: [
      { name: "childIpId", internalType: "address", type: "address" }
    ],
    name: "LicenseRegistry__DerivativeAlreadyRegistered"
  },
  {
    type: "error",
    inputs: [
      { name: "childIpId", internalType: "address", type: "address" }
    ],
    name: "LicenseRegistry__DerivativeIpAlreadyHasChild"
  },
  {
    type: "error",
    inputs: [
      { name: "childIpId", internalType: "address", type: "address" }
    ],
    name: "LicenseRegistry__DerivativeIpAlreadyHasLicense"
  },
  {
    type: "error",
    inputs: [{ name: "ipId", internalType: "address", type: "address" }],
    name: "LicenseRegistry__DerivativeIsParent"
  },
  {
    type: "error",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    name: "LicenseRegistry__DuplicateLicense"
  },
  {
    type: "error",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      { name: "index", internalType: "uint256", type: "uint256" },
      { name: "length", internalType: "uint256", type: "uint256" }
    ],
    name: "LicenseRegistry__IndexOutOfBounds"
  },
  {
    type: "error",
    inputs: [{ name: "ipId", internalType: "address", type: "address" }],
    name: "LicenseRegistry__IpExpired"
  },
  {
    type: "error",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    name: "LicenseRegistry__LicenseTermsAlreadyAttached"
  },
  {
    type: "error",
    inputs: [
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    name: "LicenseRegistry__LicenseTermsNotExists"
  },
  {
    type: "error",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    name: "LicenseRegistry__LicensorIpHasNoLicenseTerms"
  },
  {
    type: "error",
    inputs: [
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      }
    ],
    name: "LicenseRegistry__NotLicenseTemplate"
  },
  {
    type: "error",
    inputs: [{ name: "ipId", internalType: "address", type: "address" }],
    name: "LicenseRegistry__ParentIpExpired"
  },
  {
    type: "error",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    name: "LicenseRegistry__ParentIpHasNoLicenseTerms"
  },
  {
    type: "error",
    inputs: [{ name: "ipId", internalType: "address", type: "address" }],
    name: "LicenseRegistry__ParentIpTagged"
  },
  {
    type: "error",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      }
    ],
    name: "LicenseRegistry__ParentIpUnmatchedLicenseTemplate"
  },
  {
    type: "error",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "newLicenseTemplate",
        internalType: "address",
        type: "address"
      }
    ],
    name: "LicenseRegistry__UnmatchedLicenseTemplate"
  },
  {
    type: "error",
    inputs: [
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      }
    ],
    name: "LicenseRegistry__UnregisteredLicenseTemplate"
  },
  { type: "error", inputs: [], name: "LicenseRegistry__ZeroAccessManager" },
  { type: "error", inputs: [], name: "LicenseRegistry__ZeroDisputeModule" },
  { type: "error", inputs: [], name: "LicenseRegistry__ZeroIPGraphACL" },
  { type: "error", inputs: [], name: "LicenseRegistry__ZeroLicenseTemplate" },
  { type: "error", inputs: [], name: "LicenseRegistry__ZeroLicensingModule" },
  {
    type: "error",
    inputs: [],
    name: "LicensingModule__DerivativesCannotAddLicenseTerms"
  },
  {
    type: "error",
    inputs: [
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    name: "LicensingModule__LicenseTermsNotFound"
  },
  { type: "error", inputs: [], name: "NotInitializing" },
  { type: "error", inputs: [], name: "UUPSUnauthorizedCallContext" },
  {
    type: "error",
    inputs: [{ name: "slot", internalType: "bytes32", type: "bytes32" }],
    name: "UUPSUnsupportedProxiableUUID"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "authority",
        internalType: "address",
        type: "address",
        indexed: false
      }
    ],
    name: "AuthorityUpdated"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address",
        indexed: false
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256",
        indexed: false
      }
    ],
    name: "DefaultLicenseTermsSet"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "ipId",
        internalType: "address",
        type: "address",
        indexed: true
      },
      {
        name: "expireTime",
        internalType: "uint256",
        type: "uint256",
        indexed: false
      }
    ],
    name: "ExpirationTimeSet"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "version",
        internalType: "uint64",
        type: "uint64",
        indexed: false
      }
    ],
    name: "Initialized"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address",
        indexed: true
      }
    ],
    name: "LicenseTemplateRegistered"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "ipId",
        internalType: "address",
        type: "address",
        indexed: true
      },
      {
        name: "licensingConfig",
        internalType: "struct Licensing.LicensingConfig",
        type: "tuple",
        components: [
          { name: "isSet", internalType: "bool", type: "bool" },
          {
            name: "mintingFee",
            internalType: "uint256",
            type: "uint256"
          },
          {
            name: "licensingHook",
            internalType: "address",
            type: "address"
          },
          { name: "hookData", internalType: "bytes", type: "bytes" }
        ],
        indexed: false
      }
    ],
    name: "LicensingConfigSetForIP"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "ipId",
        internalType: "address",
        type: "address",
        indexed: true
      },
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address",
        indexed: true
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256",
        indexed: true
      }
    ],
    name: "LicensingConfigSetForLicense"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "implementation",
        internalType: "address",
        type: "address",
        indexed: true
      }
    ],
    name: "Upgraded"
  },
  {
    type: "function",
    inputs: [],
    name: "DISPUTE_MODULE",
    outputs: [
      {
        name: "",
        internalType: "contract IDisputeModule",
        type: "address"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "EXPIRATION_TIME",
    outputs: [{ name: "", internalType: "bytes32", type: "bytes32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "IP_GRAPH",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "IP_GRAPH_ACL",
    outputs: [
      { name: "", internalType: "contract IPGraphACL", type: "address" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "LICENSING_MODULE",
    outputs: [
      {
        name: "",
        internalType: "contract ILicensingModule",
        type: "address"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "UPGRADE_INTERFACE_VERSION",
    outputs: [{ name: "", internalType: "string", type: "string" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    name: "attachLicenseTermsToIp",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [],
    name: "authority",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    name: "exists",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      { name: "index", internalType: "uint256", type: "uint256" }
    ],
    name: "getAttachedLicenseTerms",
    outputs: [
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [{ name: "ipId", internalType: "address", type: "address" }],
    name: "getAttachedLicenseTermsCount",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "getDefaultLicenseTerms",
    outputs: [
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "parentIpId", internalType: "address", type: "address" },
      { name: "index", internalType: "uint256", type: "uint256" }
    ],
    name: "getDerivativeIp",
    outputs: [
      { name: "childIpId", internalType: "address", type: "address" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "parentIpId", internalType: "address", type: "address" }
    ],
    name: "getDerivativeIpCount",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [{ name: "ipId", internalType: "address", type: "address" }],
    name: "getExpireTime",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    name: "getLicensingConfig",
    outputs: [
      {
        name: "",
        internalType: "struct Licensing.LicensingConfig",
        type: "tuple",
        components: [
          { name: "isSet", internalType: "bool", type: "bool" },
          {
            name: "mintingFee",
            internalType: "uint256",
            type: "uint256"
          },
          {
            name: "licensingHook",
            internalType: "address",
            type: "address"
          },
          { name: "hookData", internalType: "bytes", type: "bytes" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "childIpId", internalType: "address", type: "address" },
      { name: "index", internalType: "uint256", type: "uint256" }
    ],
    name: "getParentIp",
    outputs: [
      { name: "parentIpId", internalType: "address", type: "address" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "childIpId", internalType: "address", type: "address" }
    ],
    name: "getParentIpCount",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "childIpId", internalType: "address", type: "address" },
      { name: "parentIpId", internalType: "address", type: "address" }
    ],
    name: "getParentLicenseTerms",
    outputs: [
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "parentIpId", internalType: "address", type: "address" }
    ],
    name: "hasDerivativeIps",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    name: "hasIpAttachedLicenseTerms",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "accessManager", internalType: "address", type: "address" }
    ],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [],
    name: "isConsumingScheduledOp",
    outputs: [{ name: "", internalType: "bytes4", type: "bytes4" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "childIpId", internalType: "address", type: "address" }
    ],
    name: "isDerivativeIp",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [{ name: "ipId", internalType: "address", type: "address" }],
    name: "isExpiredNow",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "parentIpId", internalType: "address", type: "address" },
      { name: "childIpId", internalType: "address", type: "address" }
    ],
    name: "isParentIp",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      }
    ],
    name: "isRegisteredLicenseTemplate",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "proxiableUUID",
    outputs: [{ name: "", internalType: "bytes32", type: "bytes32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "childIpId", internalType: "address", type: "address" },
      {
        name: "parentIpIds",
        internalType: "address[]",
        type: "address[]"
      },
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsIds",
        internalType: "uint256[]",
        type: "uint256[]"
      },
      { name: "isUsingLicenseToken", internalType: "bool", type: "bool" }
    ],
    name: "registerDerivativeIp",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      }
    ],
    name: "registerLicenseTemplate",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "newAuthority", internalType: "address", type: "address" }
    ],
    name: "setAuthority",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      {
        name: "newLicenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "newLicenseTermsId",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    name: "setDefaultLicenseTerms",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      {
        name: "licensingConfig",
        internalType: "struct Licensing.LicensingConfig",
        type: "tuple",
        components: [
          { name: "isSet", internalType: "bool", type: "bool" },
          {
            name: "mintingFee",
            internalType: "uint256",
            type: "uint256"
          },
          {
            name: "licensingHook",
            internalType: "address",
            type: "address"
          },
          { name: "hookData", internalType: "bytes", type: "bytes" }
        ]
      }
    ],
    name: "setLicensingConfigForIp",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "ipId", internalType: "address", type: "address" },
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      },
      {
        name: "licensingConfig",
        internalType: "struct Licensing.LicensingConfig",
        type: "tuple",
        components: [
          { name: "isSet", internalType: "bool", type: "bool" },
          {
            name: "mintingFee",
            internalType: "uint256",
            type: "uint256"
          },
          {
            name: "licensingHook",
            internalType: "address",
            type: "address"
          },
          { name: "hookData", internalType: "bytes", type: "bytes" }
        ]
      }
    ],
    name: "setLicensingConfigForLicense",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      {
        name: "newImplementation",
        internalType: "address",
        type: "address"
      },
      { name: "data", internalType: "bytes", type: "bytes" }
    ],
    name: "upgradeToAndCall",
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    inputs: [
      { name: "licensorIpId", internalType: "address", type: "address" },
      {
        name: "licenseTemplate",
        internalType: "address",
        type: "address"
      },
      {
        name: "licenseTermsId",
        internalType: "uint256",
        type: "uint256"
      },
      { name: "isMintedByIpOwner", internalType: "bool", type: "bool" }
    ],
    name: "verifyMintLicenseToken",
    outputs: [
      {
        name: "",
        internalType: "struct Licensing.LicensingConfig",
        type: "tuple",
        components: [
          { name: "isSet", internalType: "bool", type: "bool" },
          {
            name: "mintingFee",
            internalType: "uint256",
            type: "uint256"
          },
          {
            name: "licensingHook",
            internalType: "address",
            type: "address"
          },
          { name: "hookData", internalType: "bytes", type: "bytes" }
        ]
      }
    ],
    stateMutability: "view"
  }
];
async function hasIpAttachedLicenseTerms(publicClient, request) {
  return await publicClient.readContract({
    abi: licenseRegistryAbi,
    address: "0xBda3992c49E98392e75E78d82B934F3598bA495f",
    functionName: "hasIpAttachedLicenseTerms",
    args: [request.ipId, request.licenseTemplate, request.licenseTermsId]
  });
}

// src/actions/licenseIP.ts
var LicenseIPAction = class {
  constructor(walletProvider) {
    this.walletProvider = walletProvider;
  }
  async licenseIP(params) {
    const storyClient = this.walletProvider.getStoryClient();
    const publicClient = this.walletProvider.getPublicClient();
    const hasLicenseTerms = await hasIpAttachedLicenseTerms(publicClient, {
      ipId: params.licensorIpId,
      licenseTemplate: "0x58E2c909D557Cd23EF90D14f8fd21667A5Ae7a93",
      licenseTermsId: BigInt(params.licenseTermsId)
    });
    if (!hasLicenseTerms) {
      throw new Error("License terms are not attached to the IP Asset");
    }
    const response = await storyClient.license.mintLicenseTokens({
      licensorIpId: params.licensorIpId,
      licenseTermsId: params.licenseTermsId,
      amount: params.amount || 1,
      txOptions: { waitForTransaction: true }
    });
    return response;
  }
};
var licenseIPAction = {
  name: "LICENSE_IP",
  description: "License an IP Asset on Story",
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger2.log("Starting LICENSE_IP handler...");
    let currentState = state;
    if (!currentState) {
      currentState = await runtime.composeState(message);
    } else {
      currentState = await runtime.updateRecentMessageState(currentState);
    }
    const licenseIPContext = composeContext2({
      state: currentState,
      template: licenseIPTemplate
    });
    const content = await generateObjectDeprecated2({
      runtime,
      context: licenseIPContext,
      modelClass: ModelClass2.SMALL
    });
    const walletProvider = new WalletProvider(runtime);
    const action = new LicenseIPAction(walletProvider);
    try {
      const response = await action.licenseIP(content);
      callback?.({
        text: `Successfully minted license tokens: ${response.licenseTokenIds.join(", ")}. Transaction Hash: ${response.txHash}. View it on the block explorer: https://odyssey.storyscan.xyz/tx/${response.txHash}`
      });
      return true;
    } catch (e) {
      elizaLogger2.error("Error licensing IP:", e.message);
      callback?.({ text: `Error licensing IP: ${e.message}` });
      return false;
    }
  },
  template: licenseIPTemplate,
  validate: async (runtime) => {
    const privateKey = runtime.getSetting("STORY_PRIVATE_KEY");
    return typeof privateKey === "string" && privateKey.startsWith("0x");
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "I would like to license an IP."
        }
      },
      {
        user: "{{user2}}",
        content: {
          text: "Sure! Please provide the ipId of the IP you want to license and the license terms id you want to attach.",
          action: "LICENSE_IP"
        }
      },
      {
        user: "{{user1}}",
        content: {
          text: "License an IP Asset 0x2265F2b8e47F98b3Bdf7a1937EAc27282954A4Db with license terms 1"
        }
      }
    ]
  ],
  similes: ["LICENSE", "LICENSE_IP", "LICENSE_IP_ASSET"]
};

// src/actions/attachTerms.ts
import {
  composeContext as composeContext3,
  elizaLogger as elizaLogger3,
  generateObjectDeprecated as generateObjectDeprecated3,
  ModelClass as ModelClass3
} from "@elizaos/core";
import { zeroAddress } from "viem";
var AttachTermsAction = class {
  constructor(walletProvider) {
    this.walletProvider = walletProvider;
  }
  async attachTerms(params) {
    const storyClient = this.walletProvider.getStoryClient();
    elizaLogger3.log("params", params);
    const licenseTerms = {
      transferable: true,
      royaltyPolicy: params.commercialUse ? "0x28b4F70ffE5ba7A26aEF979226f77Eb57fb9Fdb6" : zeroAddress,
      defaultMintingFee: params.mintingFee ? BigInt(params.mintingFee) : BigInt(0),
      expiration: BigInt(0),
      commercialUse: params.commercialUse || false,
      commercialAttribution: false,
      commercializerChecker: zeroAddress,
      commercializerCheckerData: zeroAddress,
      commercialRevShare: params.commercialUse ? params.commercialRevShare : 0,
      commercialRevCeiling: BigInt(0),
      derivativesAllowed: true,
      derivativesAttribution: true,
      derivativesApproval: false,
      derivativesReciprocal: true,
      derivativeRevCeiling: BigInt(0),
      currency: "0xC0F6E387aC0B324Ec18EAcf22EE7271207dCE3d5",
      uri: ""
    };
    const registerPilTermsResponse = await storyClient.license.registerPILTerms({
      ...licenseTerms,
      txOptions: { waitForTransaction: true }
    });
    const attachTermsResponse = await storyClient.license.attachLicenseTerms({
      ipId: params.ipId,
      licenseTermsId: registerPilTermsResponse.licenseTermsId,
      txOptions: { waitForTransaction: true }
    });
    return { attachTermsResponse, registerPilTermsResponse };
  }
};
var attachTermsAction = {
  name: "ATTACH_TERMS",
  description: "Attach license terms to an IP Asset on Story",
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger3.log("Starting ATTACH_TERMS handler...");
    let currentState = state;
    if (!currentState) {
      currentState = await runtime.composeState(message);
    } else {
      currentState = await runtime.updateRecentMessageState(currentState);
    }
    const attachTermsContext = composeContext3({
      state: currentState,
      template: attachTermsTemplate
    });
    const content = await generateObjectDeprecated3({
      runtime,
      context: attachTermsContext,
      modelClass: ModelClass3.SMALL
    });
    const walletProvider = new WalletProvider(runtime);
    const action = new AttachTermsAction(walletProvider);
    try {
      const response = await action.attachTerms(content);
      if (response.attachTermsResponse.success) {
        callback?.({
          text: `Successfully attached license terms: ${response.registerPilTermsResponse.licenseTermsId}. Transaction Hash: ${response.attachTermsResponse.txHash}. View it on the block explorer: https://odyssey.storyscan.xyz/tx/${response.attachTermsResponse.txHash}`
        });
        return true;
      }
      callback?.({
        text: `License terms ${response.registerPilTermsResponse.licenseTermsId} were already attached to IP Asset ${content.ipId}`
      });
      return true;
    } catch (e) {
      elizaLogger3.error("Error licensing IP:", e.message);
      callback?.({ text: `Error licensing IP: ${e.message}` });
      return false;
    }
  },
  template: attachTermsTemplate,
  validate: async (runtime) => {
    const privateKey = runtime.getSetting("STORY_PRIVATE_KEY");
    return typeof privateKey === "string" && privateKey.startsWith("0x");
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "I would like to attach license terms to my IP.",
          action: "ATTACH_TERMS"
        }
      },
      {
        user: "{{user2}}",
        content: {
          text: "Sure! What is the ipId? You should also tell me if you want to add a minting fee, or if you want to enable commercial use of your IP. If so, you can add a revenue share as well.",
          action: "ATTACH_TERMS"
        }
      },
      {
        user: "{{user1}}",
        content: {
          text: "Attach commercial, 10% rev share license terms to IP Asset 0x2265F2b8e47F98b3Bdf7a1937EAc27282954A4Db"
        }
      }
    ]
  ],
  similes: ["ATTACH_TERMS", "ATTACH_TERMS_TO_IP"]
};

// src/actions/getAvailableLicenses.ts
import {
  composeContext as composeContext4,
  elizaLogger as elizaLogger5,
  generateObjectDeprecated as generateObjectDeprecated4,
  ModelClass as ModelClass4
} from "@elizaos/core";

// src/lib/api.ts
import { elizaLogger as elizaLogger4 } from "@elizaos/core";
var API_BASE_URL = process.env.STORY_API_BASE_URL;
var API_VERSION = "v2";
var API_URL = `${API_BASE_URL}/${API_VERSION}`;
var API_KEY = process.env.STORY_API_KEY || "";
async function getResource(resourceName, resourceId, _options) {
  try {
    elizaLogger4.log(
      `Fetching resource ${API_URL}/${resourceName}/${resourceId}`
    );
    const res = await fetch(`${API_URL}/${resourceName}/${resourceId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-chain": "1516"
      }
    });
    if (res.ok) {
      elizaLogger4.log("Response is ok");
      return res.json();
    }
    elizaLogger4.log("Response is not ok");
    elizaLogger4.log(JSON.stringify(res));
    throw new Error(`HTTP error! status: ${res.status}`);
  } catch (error) {
    console.error(error);
  }
}

// src/actions/getAvailableLicenses.ts
import { storyOdyssey as storyOdyssey2 } from "viem/chains";
var GetAvailableLicensesAction = class {
  // Default query options for license terms
  defaultQueryOptions = {
    pagination: { limit: 10, offset: 0 },
    orderBy: "blockNumber",
    orderDirection: "desc"
  };
  async getAvailableLicenses(params) {
    elizaLogger5.log(
      "Fetching from",
      `${API_URL}/${"detailed-ip-license-terms" /* IP_LICENSE_DETAILS */}`
    );
    const response = await fetch(
      `${API_URL}/${"detailed-ip-license-terms" /* IP_LICENSE_DETAILS */}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "x-chain": storyOdyssey2.id.toString()
        },
        cache: "no-cache",
        body: JSON.stringify({
          ip_ids: [params.ipid],
          options: this.defaultQueryOptions
        })
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    try {
      const text = await response.text();
      const licenseDetailsResponse = JSON.parse(text);
      elizaLogger5.log("licenseDetailsResponse", licenseDetailsResponse);
      return licenseDetailsResponse;
    } catch (e) {
      elizaLogger5.error("Failed to parse response");
      throw new Error(`Failed to parse JSON response: ${e.message}`);
    }
  }
};
var formatLicenseTerms = (license) => {
  const terms = license.terms;
  return `License ID: ${license.id}
- Terms:
  \u2022 Commercial Use: ${terms.commercialUse ? "Allowed" : "Not Allowed"}
  \u2022 Commercial Attribution: ${terms.commercialAttribution ? "Required" : "Not Required"}
  \u2022 Derivatives: ${terms.derivativesAllowed ? "Allowed" : "Not Allowed"}
  \u2022 Derivatives Attribution: ${terms.derivativesAttribution ? "Required" : "Not Required"}
  \u2022 Derivatives Approval: ${terms.derivativesApproval ? "Required" : "Not Required"}
  \u2022 Revenue Share: ${terms.commercialRevenueShare ? `${terms.commercialRevenueShare}%` : "Not Required"}`;
};
var getAvailableLicensesAction = {
  name: "GET_AVAILABLE_LICENSES",
  description: "Get available licenses for an IP Asset on Story",
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger5.log("Starting GET_AVAILABLE_LICENSES handler...");
    let currentState = state;
    if (!currentState) {
      currentState = await runtime.composeState(message);
    } else {
      currentState = await runtime.updateRecentMessageState(currentState);
    }
    const content = await generateObjectDeprecated4({
      runtime,
      context: composeContext4({
        state: currentState,
        template: getAvailableLicensesTemplate
      }),
      modelClass: ModelClass4.SMALL
    });
    const action = new GetAvailableLicensesAction();
    try {
      const response = await action.getAvailableLicenses(content);
      const formattedResponse = response.data.map(formatLicenseTerms).join("\n");
      callback?.({
        text: formattedResponse,
        action: "GET_AVAILABLE_LICENSES",
        source: "Story Protocol API"
      });
      return true;
    } catch (e) {
      elizaLogger5.error("Error fetching available licenses:", e.message);
      callback?.({
        text: `Error fetching available licenses: ${e.message}`
      });
      return false;
    }
  },
  template: getAvailableLicensesTemplate,
  validate: async () => true,
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Get available licenses for an IP Asset 0x2265F2b8e47F98b3Bdf7a1937EAc27282954A4Db",
          action: "GET_AVAILABLE_LICENSES"
        }
      }
    ]
  ],
  similes: [
    "AVAILABLE_LICENSES",
    "AVAILABLE_LICENSES_FOR_IP",
    "AVAILABLE_LICENSES_FOR_ASSET"
  ]
};

// src/actions/getIPDetails.ts
import {
  composeContext as composeContext5,
  elizaLogger as elizaLogger6,
  generateObjectDeprecated as generateObjectDeprecated5,
  ModelClass as ModelClass5
} from "@elizaos/core";
var GetIPDetailsAction = class {
  async getIPDetails(params) {
    elizaLogger6.log("Fetching from", `${API_URL}/${"assets" /* ASSET */}`);
    return await getResource(
      "assets" /* ASSET */,
      params.ipId
    );
  }
};
var formatIPDetails = (data) => `IP Asset Details:
ID: ${data.id}
NFT Name: ${data.nftMetadata.name}
Token Contract: ${data.nftMetadata.tokenContract}
Token ID: ${data.nftMetadata.tokenId}
Image URL: ${data.nftMetadata.imageUrl}

Relationships:
\u2022 Ancestors: ${data.ancestorCount}
\u2022 Descendants: ${data.descendantCount}
\u2022 Parents: ${data.parentCount || 0}
\u2022 Children: ${data.childCount || 0}
\u2022 Roots: ${data.rootCount || 0}

Created:
Block #${data.blockNumber}
Timestamp: ${data.blockTimestamp}`;
var getIPDetailsAction = {
  name: "GET_IP_DETAILS",
  description: "Get details for an IP Asset on Story",
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger6.log("Starting GET_IP_DETAILS handler...");
    let currentState = state;
    if (!currentState) {
      currentState = await runtime.composeState(message);
    } else {
      currentState = await runtime.updateRecentMessageState(currentState);
    }
    const content = await generateObjectDeprecated5({
      runtime,
      context: composeContext5({ state: currentState, template: getIPDetailsTemplate }),
      modelClass: ModelClass5.SMALL
    });
    const action = new GetIPDetailsAction();
    try {
      const response = await action.getIPDetails(content);
      const formattedResponse = formatIPDetails(response.data);
      callback?.({
        text: formattedResponse,
        action: "GET_IP_DETAILS",
        source: "Story Protocol API"
      });
      return true;
    } catch (e) {
      elizaLogger6.error("Error fetching IP details:", e.message);
      callback?.({
        text: `Error fetching IP details: ${e.message}`
      });
      return false;
    }
  },
  template: getIPDetailsTemplate,
  validate: async () => true,
  // Example usage of the action
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Get details for an IP Asset 0x2265F2b8e47F98b3Bdf7a1937EAc27282954A4Db",
          action: "GET_IP_DETAILS"
        }
      }
    ]
  ],
  similes: ["IP_DETAILS", "IP_DETAILS_FOR_ASSET", "IP_DETAILS_FOR_IP"]
};

// src/index.ts
var storyPlugin = {
  name: "story",
  description: "Story integration plugin",
  providers: [storyWalletProvider],
  evaluators: [],
  services: [],
  actions: [
    registerIPAction,
    licenseIPAction,
    attachTermsAction,
    getAvailableLicensesAction,
    getIPDetailsAction
  ]
};
var index_default = storyPlugin;
export {
  AttachTermsAction,
  DEFAULT_CHAIN_CONFIGS,
  GetAvailableLicensesAction,
  LicenseIPAction,
  RegisterIPAction,
  WalletProvider,
  attachTermsAction,
  attachTermsTemplate,
  index_default as default,
  getAvailableLicensesAction,
  getIPDetailsAction,
  getIPDetailsTemplate,
  licenseIPAction,
  licenseIPTemplate,
  registerIPAction,
  registerIPTemplate,
  storyPlugin,
  storyWalletProvider
};
//# sourceMappingURL=index.js.map