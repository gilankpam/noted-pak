'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
import { SettingsDialog } from '@/components/settings-dialog';
import { useTranscription } from '@/hook/transcription';
import { useSummarization } from '@/hook/summarization';

export default function Page() {
    const {
        isTranscribing,
        confirmedText,
        unconfirmedTextPreview,
        modelReady,
        isMicMuted,
        isPaused: isTranscriptionPaused,
        modelLoadingProgress,
        isStarting,
        handleStartTranscription,
        handleStopTranscription,
        handlePauseTranscription,
        handleResumeTranscription,
        handleToggleMic,
    } = useTranscription();

    const {
        summaryText,
        isSummarizing,
        summarizationModelReady,
        summarizationModelLoadingProgress,
        summarizationState,
        isLoadingSummarizationModelRef,
        handleStartSummarization,
        interruptSummarization,
    } = useSummarization();

    const [meetingTitle, setMeetingTitle] = useState('');
    const [editableTranscription, setEditableTranscription] = useState('');

    const currentTranscription =
        confirmedText + (unconfirmedTextPreview ? ` ${unconfirmedTextPreview}` : '');

    const handleStartRecording = async () => {
        await handleStartTranscription();
    };

    const handlePauseOrResumeRecording = () => {
        if (isTranscriptionPaused) {
            handleResumeTranscription();
        } else {
            handlePauseTranscription();
        }
    };

    const handleStopRecording = () => {
        handleStopTranscription();
        if (isSummarizing) {
            interruptSummarization();
        }
    };

    const handleEnhanceTranscription = async () => {
        if (!editableTranscription.trim() || isSummarizing || isLoadingSummarizationModelRef.current) return;
        await handleStartSummarization(editableTranscription, meetingTitle);
    };

    useEffect(() => {
        if (modelLoadingProgress) {
            console.log(`Model Loading Progress: ${modelLoadingProgress}`);
        }
    }, [modelLoadingProgress]);

    useEffect(() => {
        setEditableTranscription(currentTranscription);
    }, [currentTranscription]);

    return (
        <div
            className="w-full min-h-screen bg-white dark:bg-black transition-colors duration-200 p-6"
            data-oid="dto1tku"
        >
            {/* Header */}
            <div className="mb-8" data-oid="_6lxio0">
                <h1
                    className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2"
                    data-oid="jbld_w7"
                >
                    Meeting Transcription and Stuff
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400" data-oid="q14vrrn">
                    Record, transcribe, and enhance your meeting conversations
                </p>
            </div>

            {/* Main Content - Two Column Layout */}
            <div
                className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]"
                data-oid="hb3:.5h"
            >
                {/* Left Column - Transcription and Controls */}
                <div className="flex flex-col space-y-6" data-oid="k0bxpfl">
                    {/* Control Buttons */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6" data-oid="mbhs:q3">
                        {/* Meeting Title Input */}
                        <div className="mb-6" data-oid="8fvsjip">
                            {' '}
                            {/* Increased mb for spacing */}
                            <label
                                htmlFor="meeting-title"
                                className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2"
                                data-oid="l1127rq"
                            >
                                Meeting Title
                            </label>
                            <input
                                id="meeting-title"
                                type="text"
                                value={meetingTitle}
                                onChange={(e) => setMeetingTitle(e.target.value)}
                                placeholder="Enter meeting title (e.g., Weekly Team Standup)"
                                className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                data-oid="8i:8c47"
                            />
                        </div>

                        <div className="flex flex-wrap gap-3" data-oid="evw7onq">
                            <button
                                onClick={
                                    isTranscribing
                                        ? handlePauseOrResumeRecording
                                        : handleStartRecording
                                }
                                disabled={isStarting} // Only disable if actively starting; model readiness handled by click
                                className={`px-6 py-3 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 ${
                                    isStarting
                                        ? 'bg-gray-500 cursor-not-allowed' // Disabled/loading appearance
                                        : !isTranscribing
                                          ? 'bg-green-600 hover:bg-green-700'
                                          : isTranscriptionPaused
                                            ? 'bg-green-600 hover:bg-green-700' // Resume button
                                            : 'bg-yellow-600 hover:bg-yellow-700' // Pause button
                                }`}
                                data-oid="qou-2oq"
                            >
                                {isStarting ? (
                                    <div
                                        className="w-3 h-3 bg-white animate-pulse"
                                        data-oid="znmt.:h"
                                    ></div>
                                ) : !isTranscribing || isTranscriptionPaused ? (
                                    <svg
                                        viewBox="0 0 24 24"
                                        className="w-4 h-4 fill-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        data-oid=":0-oup-"
                                    >
                                        <path d="M8 5v14l11-7z" data-oid="4nxqhm8" />
                                    </svg>
                                ) : (
                                    <svg
                                        viewBox="0 0 24 24"
                                        className="w-4 h-4 fill-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        data-oid="n:dau1-"
                                    >
                                        <path
                                            d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"
                                            data-oid="na3zbrc"
                                        />
                                    </svg>
                                )}
                                {isStarting
                                    ? 'Starting...' // Generic starting message
                                    : !isTranscribing
                                      ? 'Start Recording' // Always "Start Recording" if not transcribing and not starting
                                      : isTranscriptionPaused
                                        ? 'Resume'
                                        : 'Pause'}
                            </button>

                            <button
                                onClick={handleStopRecording}
                                disabled={!isTranscribing}
                                className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                                data-oid="41wq.vo"
                            >
                                <div className="w-3 h-3 bg-white" data-oid="kw.zor_"></div>
                                Stop Recording
                            </button>

                            <button
                                onClick={handleToggleMic}
                                disabled={!isTranscribing || isStarting}
                                className={`px-6 py-3 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 ${
                                    !isTranscribing || isStarting
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : isMicMuted
                                          ? 'bg-blue-600 hover:bg-blue-700' // Unmute mic button
                                          : 'bg-orange-500 hover:bg-orange-600' // Mute mic button (changed to orange for distinction)
                                }`}
                                title={
                                    !isTranscribing
                                        ? 'Start recording to control mic'
                                        : isMicMuted
                                          ? 'Unmute Microphone'
                                          : 'Mute Microphone'
                                }
                                data-oid="xr3j-t-"
                            >
                                {isMicMuted ? (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={1.5}
                                        stroke="currentColor"
                                        className="w-5 h-5"
                                        data-oid="q90b3h8"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                                            data-oid=".xc_l.4"
                                        />

                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="m3 3 18 18"
                                            data-oid="1nv-7ap"
                                        />
                                    </svg>
                                ) : (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={1.5}
                                        stroke="currentColor"
                                        className="w-5 h-5"
                                        data-oid=".ygwcgc"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                                            data-oid="2e47_xy"
                                        />
                                    </svg>
                                )}
                            </button>

                            <SettingsDialog data-oid=":ga-5uu" />
                        </div>

                        {/* Status Indicator */}
                        <div className="mt-4" data-oid="tezy9b5">
                            <div className="flex items-center gap-2" data-oid="yp:1g07">
                                <div
                                    className={`w-3 h-3 rounded-full ${
                                        isTranscribing
                                            ? isTranscriptionPaused
                                                ? 'bg-yellow-500' // Paused
                                                : 'bg-green-500 animate-pulse' // Recording
                                            : modelReady
                                              ? 'bg-gray-400' // Ready
                                              : 'bg-blue-500 animate-pulse' // Loading model
                                    }`}
                                    data-oid="opl-s5i"
                                ></div>
                                <span
                                    className="text-sm text-gray-600 dark:text-gray-400"
                                    data-oid="lq:cvrz"
                                >
                                    {isStarting
                                        ? 'Loading model...'
                                        : isTranscribing
                                          ? isTranscriptionPaused
                                              ? `Recording Paused (Mic: ${isMicMuted ? 'Muted' : 'On'})`
                                              : `Recording Active (Mic: ${isMicMuted ? 'Muted' : 'On'})`
                                          : modelReady
                                            ? 'Ready to Record'
                                            : 'Click Start to Record'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Transcription Area */}
                    <div
                        className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-6"
                        data-oid=":r76ru2"
                    >
                        <div className="flex justify-between items-center mb-4" data-oid="ahe1_sf">
                            <h2
                                className="text-xl font-semibold text-gray-900 dark:text-gray-100"
                                data-oid="gzkhr_v"
                            >
                                Live Transcription
                            </h2>
                            <button
                                onClick={isSummarizing ? interruptSummarization : handleEnhanceTranscription}
                                disabled={
                                    !editableTranscription.trim() ||
                                    isTranscribing ||
                                    (!isSummarizing && isLoadingSummarizationModelRef.current) // Disable if model is loading and not already summarizing
                                }
                                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors duration-200 ${
                                    isSummarizing
                                        ? 'bg-red-600 hover:bg-red-700' // "Cancel" style
                                        : isLoadingSummarizationModelRef.current
                                          ? 'bg-gray-400 cursor-not-allowed' // Disabled/loading model style
                                          : 'bg-blue-600 hover:bg-blue-700' // "Enhance" style
                                } disabled:bg-gray-400`}
                                data-oid="y23fovk"
                            >
                                {isSummarizing
                                    ? 'Cancel Summarization'
                                    : isLoadingSummarizationModelRef.current
                                      ? 'Loading Model...'
                                      : 'Enhance Transcription'}
                            </button>
                        </div>
                        <div
                            className="h-full min-h-[300px] bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                            data-oid="x3lh--o"
                        >
                            <textarea
                                value={editableTranscription}
                                onChange={(e) => setEditableTranscription(e.target.value)}
                                placeholder={
                                    modelReady
                                        ? 'Transcription will appear here as you speak...'
                                        : 'Loading transcription model...'
                                }
                                className="w-full h-full resize-none border-none outline-none bg-transparent text-gray-900 dark:text-gray-100 text-sm leading-relaxed"
                                data-oid="1i-7s3l"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column - Enhancement Output */}
                <div className="flex flex-col" data-oid="8t:ad_7">
                    <div
                        className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 h-full"
                        data-oid="lca24.6"
                    >
                        <h2
                            className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4"
                            data-oid="w4pt:0b"
                        >
                            Meeting Enhancement
                        </h2>
                        <div
                            className="h-full min-h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col"
                            data-oid="k_v4m0y"
                        >
                            {(isLoadingSummarizationModelRef.current && !summarizationModelReady && !isSummarizing) || (isSummarizing && summarizationState === 'thinking') ? (
                                // Centered spinner for initial model loading or "thinking" state
                                <div
                                    className="flex items-center justify-center h-full"
                                    data-oid="lahv_3."
                                >
                                    <div className="text-center" data-oid="hh0tr:5">
                                        <div
                                            className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"
                                            data-oid="zwznm67"
                                        ></div>
                                        <p
                                            className="text-gray-600 dark:text-gray-400"
                                            data-oid="rlojq_6"
                                        >
                                            {isSummarizing && summarizationState === 'thinking'
                                                ? 'Thinking...'
                                                : summarizationModelLoadingProgress || 'Loading summarization model...'}
                                        </p>
                                        {isSummarizing && summarizationState === 'thinking' && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                The model is processing the information.
                                            </p>
                                        )}
                                        
                                    </div>
                                </div>
                            ) : (
                                // Display area for summary text (streaming or complete) or placeholder
                                <>
                                    <div
                                        className="flex-grow text-gray-900 dark:text-gray-100 text-sm leading-relaxed prose dark:prose-invert" // Added prose classes for markdown styling
                                        data-oid="w5bttnp"
                                    >
                                        {summaryText ? <ReactMarkdown>{summaryText}</ReactMarkdown> : (!isSummarizing && !isLoadingSummarizationModelRef.current && (
                                            <div
                                                className="flex items-center justify-center h-full"
                                                data-oid="djxws0r"
                                            >
                                                <p
                                                    className="text-gray-500 dark:text-gray-400 text-center"
                                                    data-oid="m_94wji"
                                                >
                                                    {summarizationModelLoadingProgress && !summarizationModelReady && !isLoadingSummarizationModelRef.current
                                                        ? summarizationModelLoadingProgress // Show error if loading failed
                                                        : 'Enhanced transcription will appear here after processing.'}
                                                    <br data-oid="scenlgf" />
                                                    {!summarizationModelLoadingProgress && (
                                                        <span className="text-sm" data-oid="ajmvexu">
                                                            Click "Enhance Transcription" to get started.
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
