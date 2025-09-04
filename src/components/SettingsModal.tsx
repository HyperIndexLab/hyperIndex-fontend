import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slippage: number;
  onSlippageChange: (value: number) => void;
  deadline: number;
  onDeadlineChange: (value: number) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  slippage,
  onSlippageChange,
  deadline,
  onDeadlineChange,
}) => {
  if (!isOpen) return null;

  const handleSlippageChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      onSlippageChange(numValue);
    }
  };

  const handleDeadlineChange = (value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0) {
      onDeadlineChange(numValue);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-base-200 rounded-2xl w-[400px] p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium">Settings</h3>
          <button 
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Slippage Settings */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base-content/60">Slippage Tolerance</span>
            <div className="tooltip" data-tip="Your transaction will revert if the price changes unfavorably by more than this percentage.">
              <InformationCircleIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              className={`btn btn-sm ${slippage === 0.1 ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onSlippageChange(0.1)}
            >
              0.1%
            </button>
            <button 
              className={`btn btn-sm ${slippage === 0.5 ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onSlippageChange(0.5)}
            >
              0.5%
            </button>
            <button 
              className={`btn btn-sm ${slippage === 1.0 ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onSlippageChange(1.0)}
            >
              1.0%
            </button>
            <div className="join">
              <input
                type="number"
                className="input input-bordered input-sm w-[100px] join-item"
                value={slippage}
                onChange={(e) => handleSlippageChange(e.target.value)}
                min="0.01"
                step="0.1"
              />
              <span className="btn btn-sm join-item no-animation">%</span>
            </div>
          </div>
          {slippage >= 5 && (
            <div className="text-error text-sm mt-2">
              ⚠️ High slippage increases the risk of price impact
            </div>
          )}
        </div>

        {/* Transaction Deadline */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base-content/60">Transaction Deadline</span>
            <div className="tooltip" data-tip="Your transaction will revert if it is pending for more than this period of time.">
              <InformationCircleIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="join">
            <input
              type="number"
              className="input input-bordered input-sm w-[100px] join-item"
              value={deadline}
              onChange={(e) => handleDeadlineChange(e.target.value)}
              min="1"
            />
            <span className="btn btn-sm join-item no-animation">minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal; 