import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDollar } from "@fortawesome/free-solid-svg-icons";
import {
  useAccount,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";

const BuyWithUsdtModal = () => {
  const { address: useAccountAddress, isConnected: useAccountIsConnected } = useAccount();

  function Log(stringToLog) {
    const timeElapsed = Date.now();
    const today = new Date(timeElapsed);
    console.log(today.toUTCString() + " | " + stringToLog);
  }

  class Presale {
    constructor(presaleData) {
      this.preSaleDataLocal = presaleData;
      if (this.preSaleDataLocal) {
        const presaleSplit = presaleData.toString().split(",");
        let counter = 0;
        this.saleToken = presaleSplit[counter++];
        this.startTime = new Date(presaleSplit[counter++] * 1000);
        this.endTime = new Date(presaleSplit[counter++] * 1000);
        this.price = presaleSplit[counter++] / 10 ** 18;
        this.tokensToSell = presaleSplit[counter++];
        this.tokensToSellParsed = new Intl.NumberFormat().format(this.tokensToSell);
        this.presaleGoal = this.tokensToSell * this.price;
        this.preSaleGoalParsed = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(this.presaleGoal);
        this.baseDecimals = presaleSplit[counter++];
        this.inSale = presaleSplit[counter++];
        this.tokensSold = this.tokensToSell - this.inSale;
        this.presaleFundsRaised = this.tokensSold * this.price;
        this.presaleFundsRaisedParsed = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(this.presaleFundsRaised);
        this.tokensSoldParsed = new Intl.NumberFormat().format(this.tokensSold);
        this.vestingStartTime = new Date(presaleSplit[counter++] * 1000);
        this.vestingCliff = presaleSplit[counter++];
        this.vestingPeriod = presaleSplit[counter++];
        this.enableBuyWithEth = Boolean(parseInt(presaleSplit[counter++]));
        this.enableBuyWithUsdt = Boolean(parseInt(presaleSplit[counter++]));
        this.salePercentage = (this.tokensSold * 100) / this.tokensToSell;
        this.salePercentageParsed = this.salePercentage.toFixed(2) + "%";
      }
    }

    get HtmlOutput() {
      if (this.preSaleDataLocal) {
        return (
          <>
            <p>Sale Token: {this.saleToken}</p>
            <p>startTime: {this.startTime.toLocaleString("default")}</p>
            <p>endTime: {this.endTime.toLocaleString("default")}</p>
            <p>price: {this.price.toFixed(3)}$ per Token</p>
            <p>tokensToSell: {new Intl.NumberFormat().format(this.tokensToSell)} Token</p>
            <p>inSale: {new Intl.NumberFormat().format(this.inSale)} Token</p>
            <p>tokensSold: {new Intl.NumberFormat().format(this.tokensSold)} Token</p>
            <p>presaleGoal: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(this.presaleGoal)} $</p>
            <p>baseDecimals: {this.baseDecimals}</p>
            <p>vestingStartTime: {this.vestingStartTime.toLocaleString("default")}</p>
            <p>vestingCliff: {this.vestingCliff}</p>
            <p>vestingPeriod: {this.vestingPeriod}</p>
            <p>enableBuyWithEth: {this.enableBuyWithEth.toString()}</p>
            <p>enableBuyWithUsdt: {this.enableBuyWithUsdt.toString()}</p>
          </>
        );
      } else return <></>;
    }
  }

  function printPresaleData(presaleData) {
    const preSale = new Presale(presaleData);
    setPresaleDataParsed(preSale);
  }

  /* Constants */
  const [tokens, setTokens] = useState(10000);
  const [usdt, setUsdt] = useState(0);
  const [usdtInputBoxClassName, setUsdtInputBoxClassName] = useState("");
  const [usdtInputBoxError, setUsdtInputBoxError] = useState("");
  const [convertToUsdtButtonClass, setConvertToUsdtButtonClass] = useState("");
  const [convertToUsdtDisabled, setConvertToUsdtDisabled] = useState(false);
  const [convertToUsdtInProcessText, setConvertToUsdtInProcessText] = useState("");

  /* Presale Data */
  const [presaleDataParsed, setPresaleDataParsed] = useState(0);
  const { data: presaleData } = useContractRead({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.toString(),
    abi: process.env.NEXT_PUBLIC_CONTRACT_ABI,
    functionName: "presale",
    args: [process.env.NEXT_PUBLIC_PRESALE_ID],
    watch: true,
  });

  /* USDT Interface Contract Address */
  const { data: usdtContractAddress } = useContractRead({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.toString(),
    abi: process.env.NEXT_PUBLIC_CONTRACT_ABI,
    functionName: "USDTInterface",
    watch: false,
  });

  /* USDT Buy Helper */
  const { data: usdtAllowanceHelper } = useContractRead({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.toString(),
    abi: process.env.NEXT_PUBLIC_CONTRACT_ABI,
    functionName: "usdtBuyHelper",
    args: [process.env.NEXT_PUBLIC_PRESALE_ID, tokens],
    watch: true,
  });

  /* USDT Allowance */
  const [accountAllowancePublic, setAccountAllowance] = useState();
  const { data: accountAllowance } = useContractRead({
    address: usdtContractAddress,
    abi: process.env.NEXT_PUBLIC_STABLE_COIN_CONTRACT_ABI,
    functionName: "allowance",
    args: useAccountAddress ? [useAccountAddress, process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.toString()] : [],
    watch: true,
    enabled: !!useAccountAddress,
  });

  useEffect(() => {
    if (accountAllowance) setAccountAllowance(accountAllowance.toString());
  }, [accountAllowance]);

  /* USDT BalanceOf */
  const [usdtBalanceOfWalletConnected, setUsdtBalanceOfWalletConnected] = useState();
  const { data: usdtBalanceOfWalletData } = useContractRead({
    address: usdtContractAddress,
    abi: process.env.NEXT_PUBLIC_STABLE_COIN_CONTRACT_ABI,
    functionName: "balanceOf",
    args: useAccountAddress ? [useAccountAddress] : [],
    watch: true,
    enabled: !!useAccountAddress,
  });

  useEffect(() => {
    if (usdtBalanceOfWalletData) {
      const usdtBalanceParsed = usdtBalanceOfWalletData / 10 ** 6;
      Log("----> usdtBalanceParsed: " + usdtBalanceParsed);
      setUsdtBalanceOfWalletConnected(usdtBalanceParsed);
    }
  }, [usdtBalanceOfWalletData]);

  const { config: usdtAllowanceConfig } = usePrepareContractWrite({
    address: usdtContractAddress,
    abi: process.env.NEXT_PUBLIC_STABLE_COIN_CONTRACT_ABI,
    functionName: 'approve',
    chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID),
    args: [process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.toString(), usdtAllowanceHelper],
    enabled: useAccountIsConnected,
  });

  const { data: usdtAllowanceData, write: usdtAllowanceWrite, isLoading: usdtAllowanceIsLoading } = useContractWrite(usdtAllowanceConfig);
  const { isLoading: waitForTransactionUsdtAllowanceIsLoading, isSuccess: waitForTransactionUsdtAllowanceIsSuccess } = useWaitForTransaction({
    hash: usdtAllowanceData?.hash,
  });

  /* Buy with USDT */
  const { config: buyWithUsdtConfig } = usePrepareContractWrite({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.toString(),
    abi: process.env.NEXT_PUBLIC_CONTRACT_ABI,
    functionName: 'buyWithUSDT',
    chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID),
    args: [process.env.NEXT_PUBLIC_PRESALE_ID, tokens],
    enabled: useAccountIsConnected && (accountAllowancePublic >= usdtAllowanceHelper),
  });

  const { data: buyWithUsdtData, write: buyWithUsdt, isLoading: isBuyWithUsdtLoading } = useContractWrite(buyWithUsdtConfig);
  const { isLoading: waitForTransactionIsLoading, isSuccess: waitForTransactionIsSuccess } = useWaitForTransaction({
    hash: buyWithUsdtData?.hash,
  });

  useEffect(() => {
    Log("--->waitForTransactionIsSuccess: " + waitForTransactionIsSuccess);
    if (waitForTransactionIsLoading || usdtAllowanceIsLoading || isBuyWithUsdtLoading || waitForTransactionUsdtAllowanceIsLoading) {
      setConvertToUsdtInProcessText("Please confirm the transaction in your Wallet");
      setConvertToUsdtButtonClass("bg-gray-500 text-white active:bg-gray-600 uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 w-full ease-linear transition-all duration-150");
      setConvertToUsdtDisabled(true);
    } else {
      setConvertToUsdtDisabled(false);
      setConvertToUsdtButtonClass("bg-emerald-500 text-white active:bg-emerald-600 uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 w-full ease-linear transition-all duration-150");
      setConvertToUsdtInProcessText("");
    }
  }, [waitForTransactionIsLoading, usdtAllowanceIsLoading, isBuyWithUsdtLoading, waitForTransactionUsdtAllowanceIsLoading, waitForTransactionIsSuccess]);

  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <button
        className="bg-emerald-500 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
        type="button"
        onClick={() => setShowModal(true)}
      >
        Buy with USDT
      </button>
      {showModal ? (
        <>
          <div
            className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none"
          >
            <div className="relative w-auto my-6 mx-auto max-w-3xl">
              {/*content*/}
              <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none">
                {/*header*/}
                <div className="flex items-start justify-between p-5 border-b border-solid border-blueGray-200 rounded-t">
                  <h3 className="text-3xl font-semibold">
                    Buy Tokens with USDT
                  </h3>
                  <button
                    className="p-1 ml-auto bg-transparent border-0 text-black opacity-5 float-right text-3xl leading-none font-semibold outline-none focus:outline-none"
                    onClick={() => setShowModal(false)}
                  >
                    <span className="bg-transparent text-black opacity-5 h-6 w-6 text-2xl block outline-none focus:outline-none">
                      ×
                    </span>
                  </button>
                </div>
                {/*body*/}
                <div className="relative p-6 flex-auto">
                  <form>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="usdt-amount">
                      Amount of USDT to Spend
                    </label>
                    <input type="number" min="0" step="1" value={tokens}
                      onChange={(e) => {
                        setTokens(e.target.value);
                        setUsdt(e.target.value / 10 ** 6);
                      }}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                    <span className="text-gray-600 text-sm">
                      <svg className="h-6 w-6 inline-flex mx-2 text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M12 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0-10c2.2 0 4 1.8 4 4H8c0-2.2 1.8-4 4-4z" />
                        <path d="M19.4 18.6C20.6 17.3 21 15.7 21 14c0-2.8-2.2-5-5-5-1.7 0-3.3.6-4.4 1.6-.3-.5-.8-.9-1.4-1.2-.6-.3-1.2-.5-1.8-.5-2.8 0-5 2.2-5 5 0 1.7.6 3.3 1.6 4.4-.5.3-.9.8-1.2 1.4-.3.6-.5 1.2-.5 1.8 0 2.8 2.2 5 5 5 1.7 0 3.3-.6 4.4-1.6.3.5.8.9 1.4 1.2.6.3 1.2.5 1.8.5 2.8 0 5-2.2 5-5 0-1.7-.6-3.3-1.6-4.4zm-7.4 3.4c-.5-.3-.9-.8-1.2-1.4-.3-.6-.5-1.2-.5-1.8 0-2.2 1.8-4 4-4 .6 0 1.2.2 1.8.5.6.3 1.1.8 1.4 1.2 1.3 1.1 1.6 3.3.8 5-.5.9-1.3 1.7-2.2 2.2-.9.5-2 .7-3 .2-1.7-.7-3-2.7-2.2-4.4z" />
                      </svg>
                      TOKEN
                    </span>
                  </form>
                  <form className="mt-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="usdt-amount">
                      You Will Receive
                    </label>
                    <div className="flex">
                      <input type="number" value={usdt.toFixed(6)} disabled readOnly
                        className={`${usdtInputBoxClassName}`}
                      />
                      <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 rounded-r-md border border-r-0 border-gray-300">
                        <svg className="hover:animate-ping w-9 h-9 absolute inline-flex h-full w-full rounded-full opacity-75" xmlns="http://www.w3.org/2000/svg" width="2000" height="1750" viewBox="0 0 2000 1750"><path fill="#53ae94" d="M1632.3 0 367.7 0 0 785.98 1000 1750 2000 785.98 1632.3 0z" /><path d="M1138.88,626.12V473.58H1487.7V241.17H537.87V473.58H886.72V626C603.2,639,390,695.17,390,762.43S603.3,885.85,886.72,899v488.59H1139V898.91c283-13.06,495.75-69.17,495.75-136.38S1422,639.22,1139,626.16m0,231.37v-.13c-7.11.45-43.68,2.65-125.09,2.65-65.09,0-110.89-1.85-127-2.69v.21C636.36,846.47,449.4,802.85,449.4,750.66s187-95.75,437.44-106.86V814.11c16.41,1.13,63.33,3.9,128.09,3.9,77.79,0,116.9-3.24,124.07-3.9V643.8c250,11.13,436.53,54.79,436.53,106.8S1388.91,846.29,1139,857.42" fill="#fff" /></svg>
                        <svg className="relative inline-flex rounded-full w-9 h-9" xmlns="http://www.w3.org/2000/svg" width="2000" height="1750" viewBox="0 0 2000 1750"><path fill="#53ae94" d="M1632.3 0 367.7 0 0 785.98 1000 1750 2000 785.98 1632.3 0z" /><path d="M1138.88,626.12V473.58H1487.7V241.17H537.87V473.58H886.72V626C603.2,639,390,695.17,390,762.43S603.3,885.85,886.72,899v488.59H1139V898.91c283-13.06,495.75-69.17,495.75-136.38S1422,639.22,1139,626.16m0,231.37v-.13c-7.11.45-43.68,2.65-125.09,2.65-65.09,0-110.89-1.85-127-2.69v.21C636.36,846.47,449.4,802.85,449.4,750.66s187-95.75,437.44-106.86V814.11c16.41,1.13,63.33,3.9,128.09,3.9,77.79,0,116.9-3.24,124.07-3.9V643.8c250,11.13,436.53,54.79,436.53,106.8S1388.91,846.29,1139,857.42" fill="#fff" /></svg>
                        USDT
                      </span>
                    </div>
                    {usdtInputBoxError}
                  </form>
                </div>
                {/*footer*/}
                <div className="flex items-center justify-between p-6 border-t border-solid border-blueGray-200 rounded-b">
                  <button
                    className="text-red-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                    type="button"
                    onClick={() => setShowModal(false)}
                  >
                    Close
                  </button>
                  <button
                    className={`${convertToUsdtButtonClass}`}
                    disabled={convertToUsdtDisabled}
                    onClick={(e) => {
                      e.preventDefault();
                      if (accountAllowancePublic >= usdtAllowanceHelper)
                        buyWithUsdt?.();
                      else
                        usdtAllowanceWrite?.();
                    }}
                  >
                    {convertToUsdtInProcessText ? convertToUsdtInProcessText : "Convert USDT"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
};

export default BuyWithUsdtModal;
