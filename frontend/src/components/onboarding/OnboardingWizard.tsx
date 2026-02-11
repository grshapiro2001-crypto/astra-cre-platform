/**
 * OnboardingWizard - First-run onboarding flow for new users
 * 4-step wizard: Welcome → Set Criteria → Upload Document → Complete
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Sparkles, Target, Upload, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { propertyService } from '@/services/propertyService';
import { criteriaService } from '@/services/criteriaService';
import { cn } from '@/lib/utils';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROPERTY_TYPES = ['Multifamily', 'Mixed-Use', 'Office', 'Retail'];

export const OnboardingWizard = ({ isOpen, onClose }: OnboardingWizardProps) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 2: Criteria state
  const [targetMarkets, setTargetMarkets] = useState('');
  const [minUnits, setMinUnits] = useState('');
  const [minCapRate, setMinCapRate] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // Step 3: Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Handle criteria save
  const handleSaveCriteria = async () => {
    setIsLoading(true);
    try {
      await criteriaService.updateCriteria({
        criteria_name: 'Default Criteria',
        target_markets: targetMarkets || undefined,
        min_units: minUnits ? parseInt(minUnits) : undefined,
        min_cap_rate: minCapRate ? parseFloat(minCapRate) : undefined,
        property_types: selectedTypes.length > 0 ? selectedTypes.join(', ') : undefined,
      });
      setCurrentStep(3);
    } catch (err) {
      console.error('Failed to save criteria:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!uploadFile) return;

    setIsUploading(true);
    try {
      await propertyService.uploadPDF(uploadFile);
      // Move to completion step
      setCurrentStep(4);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Dropzone for file upload
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  // Handle completion
  const handleComplete = () => {
    localStorage.setItem('astra_onboarding_complete', 'true');
    onClose();
  };

  // Handle navigation
  const goToUpload = () => {
    handleComplete();
    navigate('/upload');
  };

  const goToDashboard = () => {
    handleComplete();
    navigate('/');
  };

  const goToSettings = () => {
    handleComplete();
    navigate('/settings');
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Welcome Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* Welcome Text */}
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                Welcome to Astra CRE
              </h2>
              <p className="text-lg text-muted-foreground">
                Your AI-powered investment analysis platform
              </p>
            </div>

            {/* Value Props */}
            <div className="space-y-3 py-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload OMs & BOVs to get instant extraction and scoring
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Automated deal scoring with three-layer AI analysis
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Manage your pipeline with Kanban board and deal folders
                </p>
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={() => setCurrentStep(2)}
              className="w-full"
              size="lg"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {/* Step Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Target className="w-8 h-8 text-violet-600" />
              </div>
            </div>

            {/* Step Title */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Set Investment Criteria</h2>
              <p className="text-sm text-muted-foreground">
                Optional: Define your investment preferences
              </p>
            </div>

            {/* Criteria Form */}
            <div className="space-y-4">
              {/* Target Markets */}
              <div className="space-y-2">
                <Label htmlFor="target-markets">Target Markets</Label>
                <Input
                  id="target-markets"
                  type="text"
                  value={targetMarkets}
                  onChange={(e) => setTargetMarkets(e.target.value)}
                  placeholder="e.g., Atlanta, Charlotte, Nashville"
                />
              </div>

              {/* Min Units and Cap Rate Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min-units">Min Units</Label>
                  <Input
                    id="min-units"
                    type="number"
                    value={minUnits}
                    onChange={(e) => setMinUnits(e.target.value)}
                    placeholder="e.g., 50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min-cap-rate">Min Cap Rate (%)</Label>
                  <Input
                    id="min-cap-rate"
                    type="number"
                    step="0.1"
                    value={minCapRate}
                    onChange={(e) => setMinCapRate(e.target.value)}
                    placeholder="e.g., 5.5"
                  />
                </div>
              </div>

              {/* Property Types */}
              <div className="space-y-2">
                <Label>Property Types</Label>
                <div className="grid grid-cols-2 gap-3">
                  {PROPERTY_TYPES.map((type) => (
                    <div key={type} className="flex items-center gap-2">
                      <Checkbox
                        id={`type-${type}`}
                        checked={selectedTypes.includes(type)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTypes([...selectedTypes, type]);
                          } else {
                            setSelectedTypes(selectedTypes.filter((t) => t !== type));
                          }
                        }}
                      />
                      <Label htmlFor={`type-${type}`} className="text-sm font-normal cursor-pointer">
                        {type}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSaveCriteria}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Saving...' : 'Save Criteria'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Skip Link */}
            <button
              onClick={() => setCurrentStep(3)}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {/* Step Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Upload className="w-8 h-8 text-violet-600" />
              </div>
            </div>

            {/* Step Title */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Upload First Document</h2>
              <p className="text-sm text-muted-foreground">
                Upload your first OM or BOV to see Astra in action
              </p>
            </div>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50',
                uploadFile && 'border-green-500 bg-green-500/5'
              )}
            >
              <input {...getInputProps()} />
              <div className="space-y-2">
                {uploadFile ? (
                  <>
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                    <p className="text-sm font-medium">{uploadFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="text-sm font-medium">
                      {isDragActive ? 'Drop file here' : 'Drag & drop PDF here'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or click to browse
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(2)}
                disabled={isUploading}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!uploadFile || isUploading}
                className="flex-1"
              >
                {isUploading ? 'Uploading...' : 'Upload'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Skip Link */}
            <button
              onClick={() => setCurrentStep(4)}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip — I'll explore first
            </button>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
            </div>

            {/* Success Text */}
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">You're all set!</h2>
              <p className="text-sm text-muted-foreground">
                Start exploring Astra CRE and manage your deal pipeline
              </p>
            </div>

            {/* Quick Links */}
            <div className="space-y-3 py-4">
              <Button
                onClick={goToDashboard}
                variant="outline"
                className="w-full justify-start"
                size="lg"
              >
                Go to Dashboard
              </Button>
              <Button
                onClick={goToUpload}
                variant="outline"
                className="w-full justify-start"
                size="lg"
              >
                Upload a Document
              </Button>
              <Button
                onClick={goToSettings}
                variant="outline"
                className="w-full justify-start"
                size="lg"
              >
                Adjust Settings
              </Button>
            </div>

            {/* Close Button */}
            <Button
              onClick={handleComplete}
              className="w-full"
              size="lg"
            >
              Start Exploring
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleComplete}>
      <DialogContent className="sm:max-w-lg">
        {/* Step Indicator */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                step === currentStep
                  ? 'bg-primary'
                  : step < currentStep
                  ? 'bg-primary/50'
                  : 'bg-border'
              )}
            />
          ))}
        </div>

        {/* Step Content */}
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
};
