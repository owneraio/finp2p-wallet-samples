import { prompt } from 'inquirer';
import { Asset, FiatAsset, Sdk, SettlementInstructionSourceAccount } from '@owneraio/finp2p-sdk-js';
import { ASSET_ID, getConfig, orgData, USER_CUSTODY_ACCOUNT, USER_ID } from '../config';
import { SettlementInstructionDestinationAccount } from '@owneraio/finp2p-sdk-js/lib/types/Profiles';
import { EscrowAccount, PrimarySale } from '@owneraio/finp2p-sdk-js/lib/types/Oss/OssSchemas';
import { delay, signingMethod } from './utils';

const investFlow = async (r: { quantity: number }) => {
  const sdk = new Sdk(getConfig({ ...orgData }));

  // get user object from sdk
  let user = sdk.getUser({ userId: USER_ID });
  // TODO - inject signature provider to user
  const userData = await user.getData();
  user = sdk.getUser({
    userId: USER_ID,
    withSignatureProvider: {
      publicKey: userData.publicKey,
      signingMethod: signingMethod({ custody: sdk.owneraAPI.custodyAdapter!, accountId: USER_CUSTODY_ACCOUNT }),
    },
  });

  let sourceAccount: SettlementInstructionSourceAccount | undefined;

  // get user holdings - start
  try {
    const initialHoldings = await user.getUserHoldings();
    console.info(`user ${USER_ID} holdings before issuance`, JSON.stringify(initialHoldings, null, 2));
    const userAccount = initialHoldings.find(holding => holding.assetType === 'fiat' && Number(holding.balance) > 0);
    if (!userAccount) {
      console.error(`User ${USER_ID} doesn't have account with credit.`);
      process.exit(1);
    }
    sourceAccount = {
      type: 'escrow',
      accountId: (userAccount.identifier as EscrowAccount).accountId,
      asset: {
        type: 'fiat',
        code: (userAccount.asset as FiatAsset).code,
      },
    };
  } catch (e: any) {
    console.error(e);
  }

  if (!sourceAccount) {
    console.error(`Not sufficient balance for user ${USER_ID}`);
    process.exit(1);
  }

  let assetId: string = '';
  let primarySaleId: string = '';
  let destinationAccount: SettlementInstructionDestinationAccount | undefined;

  // check if predefined asset to get its primary sale id
  if (!!ASSET_ID) {
    assetId = ASSET_ID;
    const asset = sdk.getAsset({ assetId: ASSET_ID });
    let assetData: Asset | undefined;
    try {
      assetData = await asset.getData();
    } catch (e: any) {
      console.error(`Unable to get data for asset "${ASSET_ID}". Please make sure this asset exists.`, e);
      process.exit(1);
    }
    const activePrimarySale = assetData.intents.find(i => i.type === 'primarySale' && i.status === 'ACTIVE');
    if (!activePrimarySale) {
      console.error(`No opened primary sale for asset "${ASSET_ID}".`);
      process.exit(1);
    }
    primarySaleId = activePrimarySale.id;
    const account = (activePrimarySale.intent as PrimarySale).sellingSettlementInstruction.accounts[0];
    destinationAccount = {
      type: 'escrow',
      accountId: (account.identifier as EscrowAccount).accountId,
      asset: {
        type: 'fiat',
        code: (account.asset as FiatAsset).code,
      } as FiatAsset,
    };
  }

  // if no predefined asset, prompt assets to select one with primary sale
  if (!ASSET_ID) {
    const allAssets = await sdk.owneraAPI.query.getAssets({});
    const assetsWithOpenedPrimarySale = allAssets.filter(a =>
      !!a.intents.find(i => i.type === 'primarySale' && i.status === 'ACTIVE'));
    if (!assetsWithOpenedPrimarySale.length) {
      console.error(`No asset with opened primary sale is available.`);
      process.exit(1);
    }
    const choices = assetsWithOpenedPrimarySale.map(a => `${a.id} - ${a.name}`);
    const answer = await prompt<{ asset: string}>([{ type: 'list', name: 'asset', message: 'Please choose an asset:', choices }]);

    const selectedAssetId = answer.asset.split(' ')[0];
    assetId = selectedAssetId;
    const asset = assetsWithOpenedPrimarySale.find(a => a.id === selectedAssetId)!;
    const activePrimarySale = asset.intents.find(i => i.type === 'primarySale' && i.status === 'ACTIVE')!;
    primarySaleId = activePrimarySale.id;
    const account = (activePrimarySale.intent as PrimarySale).sellingSettlementInstruction.accounts[0];
    destinationAccount = {
      type: 'escrow',
      accountId: (account.identifier as EscrowAccount).accountId,
      asset: {
        type: 'fiat',
        code: (account.asset as FiatAsset).code,
      } as FiatAsset,
    };
  }

  // Execute the issuance
  try {
    await user.executeIntent({
      assetId,
      sourceAccount,
      destinationAccount: destinationAccount!,
      amount: r.quantity.toString(),
      intentId: primarySaleId,
    });
    await delay(2000);
    // get user holdings - end
    const finalHoldings = await user.getUserHoldings();
    console.info(`user ${USER_ID} holdings before issuance`, JSON.stringify(finalHoldings, null, 2));
  } catch (e: any) {
    console.error('Intent execution failed ', e);
  }
};

(async () => await investFlow({ quantity: 50 }))().catch((e: any) => {
  console.error('Error ', e);
});
