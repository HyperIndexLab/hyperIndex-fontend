interface StepIndicatorProps {
  currentStep: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  return (
    <div className="bg-base-200/30 backdrop-blur-sm rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <div className={`w-8 h-8 rounded-full shrink-0 ${
          currentStep === 1 ? 'bg-primary/20 text-primary' : 'bg-base-content/10'
        } flex items-center justify-center font-medium`}>
          1
        </div>
        <div>
          <h2 className="font-medium mb-1 text-lg">Select Pair</h2>
          <p className="text-sm text-base-content/60">
            Choose a valid pair of tokens to provide liquidity.
          </p>
        </div>
      </div>

      <div className="divider my-4"></div>

      <div className="flex items-start gap-4">
        <div className={`w-8 h-8 rounded-full shrink-0 ${
          currentStep === 2 ? 'bg-primary/20 text-primary' : 'bg-base-content/10'
        } flex items-center justify-center font-medium`}>
          2
        </div>
        <div className={currentStep === 1 ? 'opacity-50' : ''}>
          <h2 className="font-medium mb-1 text-lg">Deposit Amount</h2>
          <p className="text-sm text-base-content/60">
            Enter the amount of tokens you want to deposit.
          </p>
        </div>
      </div>
    </div>
  );
}; 