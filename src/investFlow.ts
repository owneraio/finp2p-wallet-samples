import { prompt } from 'inquirer';
import chalk from 'chalk';
import { Asset, FiatAsset, Sdk, SettlementInstructionSourceAccount } from '@owneraio/finp2p-sdk-js';
import { ASSET_ID, getConfig, OPERATION_SUBSCRIPTION_EXPIRY, orgData, USER_CUSTODY_ACCOUNT, USER_ID } from '../config';
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
    console.info(chalk.blueBright(`user ${USER_ID} holdings before issuance`), JSON.stringify(initialHoldings, null, 2));
    const userAccount = initialHoldings.find(holding => holding.assetType === 'fiat' && Number(holding.balance) > 0);
    if (!userAccount) {
      console.error(chalk.bgRed(`User ${USER_ID} doesn't have account with credit.`));
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
  } catch (e) {
    console.error(chalk.bgRed('Error - get user holdings'), e);
  }

  if (!sourceAccount) {
    console.error(chalk.red(`Not sufficient balance for user ${USER_ID}`));
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
    } catch (e) {
      console.error(chalk.red(`Unable to get data for asset "${ASSET_ID}". Please make sure this asset exists.`), e);
      process.exit(1);
    }
    const activePrimarySale = assetData.intents.find(i => i.type === 'primarySale' && i.status === 'ACTIVE');
    if (!activePrimarySale) {
      console.error(chalk.red(`No opened primary sale for asset "${ASSET_ID}".`));
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
      console.error(chalk.red(`No asset with opened primary sale is available.`));
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
    let operation = await user.executeIntent({
      assetId,
      sourceAccount,
      destinationAccount: destinationAccount!,
      amount: r.quantity.toString(),
      intentId: primarySaleId,
    });

    // check if operation completed or wait for completion
    if (!operation.isCompleted) {
      operation = await sdk.owneraAPI.operations.waitOperationCompletion({
        cid: operation.cid,
        subscriptionExpiry: OPERATION_SUBSCRIPTION_EXPIRY,
      });
    }

    console.log(`Operation ${!!operation.error ? chalk.red('failed') : chalk.green('succeeded')}.
  ${JSON.stringify(!!operation.error ? operation.error : operation.response?.receipt, null, 2)}`);

    await delay(2000);
    // get user holdings - end
    const finalHoldings = await user.getUserHoldings();
    console.info(chalk.blueBright(`user ${USER_ID} holdings after issuance`), JSON.stringify(finalHoldings, null, 2));
  } catch (e) {
    console.error(chalk.bgRed('Intent execution failed '), e);
  }
};

(async () => await investFlow({ quantity: 50 }))().catch((e) => {
  console.error(chalk.bgRed('Error - invest flow failed'), e);
});
