import { IAgentRuntime, Provider, Memory, State, HandlerCallback, Plugin } from '@elizaos/core';
import { StoryClient, RegisterIpResponse, MintLicenseTokensResponse, AttachLicenseTermsResponse, RegisterPILResponse } from '@story-protocol/core-sdk';
import { Hash, Address, Chain, PublicClient, HttpTransport, Account, WalletClient } from 'viem';
import { Token } from '@lifi/types';

type SupportedChain = "odyssey";
interface Transaction {
    hash: Hash;
    from: Address;
    to: Address;
    value: bigint;
    data?: `0x${string}`;
    chainId?: number;
}
interface TokenWithBalance {
    token: Token;
    balance: bigint;
    formattedBalance: string;
    priceUSD: string;
    valueUSD: string;
}
interface WalletBalance {
    chain: SupportedChain;
    address: Address;
    totalValueUSD: string;
    tokens: TokenWithBalance[];
}
interface ChainMetadata {
    chainId: number;
    name: string;
    chain: Chain;
    rpcUrl: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    blockExplorerUrl: string;
}
interface ChainConfig {
    chain: Chain;
    publicClient: PublicClient<HttpTransport, Chain, Account | undefined>;
    walletClient?: WalletClient;
}
interface RegisterIPParams {
    title: string;
    description: string;
    ipType: string;
}
interface LicenseIPParams {
    licensorIpId: Address;
    licenseTermsId: string;
    amount: number;
}
interface AttachTermsParams {
    ipId: Address;
    mintingFee: number;
    commercialUse: boolean;
    commercialRevShare: number;
}
interface EvmPluginConfig {
    rpcUrl?: {
        ethereum?: string;
        base?: string;
    };
    secrets?: {
        EVM_PRIVATE_KEY: string;
    };
    testMode?: boolean;
    multicall?: {
        batchSize?: number;
        wait?: number;
    };
}
interface TokenData extends Token {
    symbol: string;
    decimals: number;
    address: Address;
    name: string;
    logoURI?: string;
    chainId: number;
}
interface TokenPriceResponse {
    priceUSD: string;
    token: TokenData;
}
interface TokenListResponse {
    tokens: TokenData[];
}
interface ProviderError extends Error {
    code?: number;
    data?: unknown;
}

declare const DEFAULT_CHAIN_CONFIGS: Record<SupportedChain, ChainMetadata>;
declare class WalletProvider {
    private storyClient;
    private publicClient;
    private walletClient;
    private address;
    runtime: IAgentRuntime;
    constructor(runtime: IAgentRuntime);
    getAddress(): Address;
    getWalletBalance(): Promise<string | null>;
    connect(): Promise<`0x${string}`>;
    getPublicClient(): PublicClient<HttpTransport, Chain, Account | undefined>;
    getWalletClient(): WalletClient;
    getStoryClient(): StoryClient;
}
declare const storyWalletProvider: Provider;

declare const registerIPTemplate = "Given the recent messages below:\n\n{{recentMessages}}\n\nExtract the following information about the requested IP registration:\n- Field \"title\": The title of your IP\n- Field \"description\": The description of your IP\n- Field \"ipType\": The type of your IP. Type of the IP Asset, can be defined arbitrarily by the\ncreator. I.e. \u201Ccharacter\u201D, \u201Cchapter\u201D, \u201Clocation\u201D, \u201Citems\u201D, \"music\", etc. If a user doesn't provide\nan ipType, you can infer it from the title and description. It should be one word.\n\nRespond with a JSON markdown block containing only the extracted values. A user must explicitly provide a title and description.\n\n```json\n{\n    \"title\": string,\n    \"description\": string,\n    \"ipType\": string\n}\n```\n";
declare const licenseIPTemplate = "Given the recent messages below:\n\n{{recentMessages}}\n\nExtract the following information about the requested IP licensing:\n- Field \"licensorIpId\": The IP Asset that you want to mint a license from\n- Field \"licenseTermsId\": The license terms that you want to mint a license for\n- Field \"amount\": The amount of licenses to mint\n\nRespond with a JSON markdown block containing only the extracted values. A user must explicitly provide a licensorIpId and licenseTermsId.\nIf they don't provide the amount, set it as null.\n\n```json\n{\n    \"licensorIpId\": string,\n    \"licenseTermsId\": string,\n    \"amount\": number | null\n}\n```\n";
declare const getIPDetailsTemplate = "Given the recent messages below:\n\n{{recentMessages}}\n\nExtract the following information about the requested IP details:\n- Field \"ipId\": The IP Asset that you want to get details for\n\nRespond with a JSON markdown block containing only the extracted values. A user must provide an ipId.\n\n```json\n{\n    \"ipId\": string\n}\n```\n";
declare const attachTermsTemplate = "Given the recent messages below:\n\n{{recentMessages}}\n\nExtract the following information about attaching license terms to an IP Asset:\n- Field \"ipId\": The IP Asset that you want to attach the license terms to\n- Field \"mintingFee\": The fee to mint this license from the IP Asset.\n- Field \"commercialUse\": Whether or not the IP Asset can be used commercially.\n- Field \"commercialRevShare\": The percentage of revenue that the IP Asset owner will receive\nfrom commercial use of the IP Asset. This must be between 0 and 100. If a user specifies\na commercialRevShare, then commercialUse must be set to true.\n\nRespond with a JSON markdown block containing only the extracted values. A user must provide an ipId. If they don't provide\nthe others fields, set them as null.\n\n```json\n{\n    \"ipId\": string,\n    \"mintingFee\": number | null,\n    \"commercialUse\": boolean | null,\n    \"commercialRevShare\": number | null\n}\n```\n";

declare class RegisterIPAction {
    private walletProvider;
    constructor(walletProvider: WalletProvider);
    registerIP(params: RegisterIPParams, runtime: IAgentRuntime): Promise<RegisterIpResponse>;
}
declare const registerIPAction: {
    name: string;
    description: string;
    handler: (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: HandlerCallback) => Promise<boolean>;
    template: string;
    validate: (runtime: IAgentRuntime) => Promise<boolean>;
    examples: ({
        user: string;
        content: {
            text: string;
            action?: undefined;
        };
    } | {
        user: string;
        content: {
            text: string;
            action: string;
        };
    })[][];
    similes: string[];
};

declare class LicenseIPAction {
    private walletProvider;
    constructor(walletProvider: WalletProvider);
    licenseIP(params: LicenseIPParams): Promise<MintLicenseTokensResponse>;
}
declare const licenseIPAction: {
    name: string;
    description: string;
    handler: (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: HandlerCallback) => Promise<boolean>;
    template: string;
    validate: (runtime: IAgentRuntime) => Promise<boolean>;
    examples: ({
        user: string;
        content: {
            text: string;
            action?: undefined;
        };
    } | {
        user: string;
        content: {
            text: string;
            action: string;
        };
    })[][];
    similes: string[];
};

declare class AttachTermsAction {
    private walletProvider;
    constructor(walletProvider: WalletProvider);
    attachTerms(params: AttachTermsParams): Promise<{
        attachTermsResponse: AttachLicenseTermsResponse;
        registerPilTermsResponse: RegisterPILResponse;
    }>;
}
declare const attachTermsAction: {
    name: string;
    description: string;
    handler: (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: HandlerCallback) => Promise<boolean>;
    template: string;
    validate: (runtime: IAgentRuntime) => Promise<boolean>;
    examples: ({
        user: string;
        content: {
            text: string;
            action: string;
        };
    } | {
        user: string;
        content: {
            text: string;
            action?: undefined;
        };
    })[][];
    similes: string[];
};

type PILTerms = {
    commercialAttribution: boolean;
    commercialRevenueCelling: number;
    commercialRevenueShare: number;
    commercialUse: boolean;
    commercializerCheck: Address;
    currency: Address;
    derivativesAllowed: boolean;
    derivativesApproval: boolean;
    derivativesAttribution: boolean;
    derivativesReciprocal: boolean;
    derivativesRevenueCelling: number;
    expiration: string;
    uRI: string;
};
type IPLicenseDetails = {
    id: string;
    ipId: Address;
    licenseTemplateId: string;
    licenseTemplate: {
        id: string;
        name: string;
        metadataUri: string;
        blockNumber: string;
        blockTime: string;
    };
    terms: PILTerms;
};

type GetAvailableLicensesParams = {
    ipid: Address;
};
type GetAvailableLicensesResponse = {
    data: IPLicenseDetails[];
};
/**
 * Class to handle fetching available licenses for an IP asset from Story Protocol
 */
declare class GetAvailableLicensesAction {
    private readonly defaultQueryOptions;
    getAvailableLicenses(params: GetAvailableLicensesParams): Promise<GetAvailableLicensesResponse>;
}
/**
 * Main action configuration for getting available licenses
 */
declare const getAvailableLicensesAction: {
    name: string;
    description: string;
    handler: (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: HandlerCallback) => Promise<boolean>;
    template: string;
    validate: () => Promise<boolean>;
    examples: {
        user: string;
        content: {
            text: string;
            action: string;
        };
    }[][];
    similes: string[];
};

/**
 * Main action configuration for getting IP details
 */
declare const getIPDetailsAction: {
    name: string;
    description: string;
    handler: (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: HandlerCallback) => Promise<boolean>;
    template: string;
    validate: () => Promise<boolean>;
    examples: {
        user: string;
        content: {
            text: string;
            action: string;
        };
    }[][];
    similes: string[];
};

declare const storyPlugin: Plugin;

export { AttachTermsAction, type AttachTermsParams, type ChainConfig, type ChainMetadata, DEFAULT_CHAIN_CONFIGS, type EvmPluginConfig, GetAvailableLicensesAction, LicenseIPAction, type LicenseIPParams, type ProviderError, RegisterIPAction, type RegisterIPParams, type SupportedChain, type TokenData, type TokenListResponse, type TokenPriceResponse, type TokenWithBalance, type Transaction, type WalletBalance, WalletProvider, attachTermsAction, attachTermsTemplate, storyPlugin as default, getAvailableLicensesAction, getIPDetailsAction, getIPDetailsTemplate, licenseIPAction, licenseIPTemplate, registerIPAction, registerIPTemplate, storyPlugin, storyWalletProvider };
