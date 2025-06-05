'use client';

import { useState, useRef, useEffect } from 'react';
import { SettingsDialog } from '@/components/settings-dialog';

export default function Page() {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [enhancement, setEnhancement] = useState('');
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [meetingTitle, setMeetingTitle] = useState('');

    const handleStartRecording = () => {
        setIsRecording(true);
        setIsPaused(false);
        // Simulate transcription for demo
        setTranscription('Recording started...\n');
    };

    const handlePauseRecording = () => {
        setIsPaused(!isPaused);
    };

    const handleStopRecording = () => {
        setIsRecording(false);
        setIsPaused(false);
        setTranscription((prev) => prev + '\nRecording stopped.');
    };

    const handleEnhanceTranscription = async () => {
        if (!transcription.trim()) return;

        setIsEnhancing(true);
        // Simulate enhancement processing
        setTimeout(() => {
            const titleSection = meetingTitle ? `Meeting: ${meetingTitle}\n\n` : '';
            setEnhancement(
                `${titleSection}Enhanced version of the transcription:\n\n${transcription}\n\nKey Points:\n• Main discussion topics identified\n• Action items extracted\n• Meeting summary generated`,
            );
            setIsEnhancing(false);
        }, 2000);
    };

    return (
        <div
            className="w-full min-h-screen bg-white dark:bg-black transition-colors duration-200 p-6"
            data-oid="wofhqz7"
        >
            {/* Header */}
            <div className="mb-8" data-oid="pn8jh87">
                <h1
                    className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2"
                    data-oid="iuacxg:"
                >
                    Meeting Transcription App
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400" data-oid="zar92g3">
                    Record, transcribe, and enhance your meeting conversations
                </p>
            </div>

            {/* Main Content - Two Column Layout */}
            <div
                className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]"
                data-oid="2_:vymq"
            >
                {/* Left Column - Transcription and Controls */}
                <div className="flex flex-col space-y-6" data-oid="8jti-e:">
                    {/* Control Buttons */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6" data-oid="nayopyw">
                        <div className="flex justify-between items-center mb-4" data-oid="e5kqrqh">
                            <h2
                                className="text-xl font-semibold text-gray-900 dark:text-gray-100"
                                data-oid="p94f7f5"
                            >
                                Recording Controls
                            </h2>
                            <SettingsDialog data-oid="do6cqyl" />
                        </div>

                        {/* Meeting Title Input */}
                        <div className="mb-4" data-oid="f2elnx3">
                            <label
                                htmlFor="meeting-title"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                                data-oid="6tblb7p"
                            >
                                Meeting Title
                            </label>
                            <input
                                id="meeting-title"
                                type="text"
                                value={meetingTitle}
                                onChange={(e) => setMeetingTitle(e.target.value)}
                                placeholder="Enter meeting title (e.g., Weekly Team Standup)"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                data-oid="mvid40s"
                            />
                        </div>

                        <div className="flex flex-wrap gap-3" data-oid="x00r9ma">
                            <button
                                onClick={isRecording ? handlePauseRecording : handleStartRecording}
                                className={`px-6 py-3 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 ${
                                    !isRecording
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : isPaused
                                          ? 'bg-green-600 hover:bg-green-700'
                                          : 'bg-yellow-600 hover:bg-yellow-700'
                                }`}
                                data-oid="6k71812"
                            >
                                <div
                                    className={`w-3 h-3 bg-white ${!isRecording ? 'rounded-full' : ''}`}
                                    data-oid="8r1v_h5"
                                ></div>
                                {!isRecording ? 'Start Recording' : isPaused ? 'Resume' : 'Pause'}
                            </button>

                            <button
                                onClick={handleStopRecording}
                                disabled={!isRecording}
                                className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                                data-oid="imxcn-5"
                            >
                                <div className="w-3 h-3 bg-white" data-oid="q.f13ls"></div>
                                Stop Recording
                            </button>
                        </div>

                        {/* Status Indicator */}
                        <div className="mt-4 flex items-center gap-2" data-oid="69l4--_">
                            <div
                                className={`w-3 h-3 rounded-full ${
                                    isRecording
                                        ? isPaused
                                            ? 'bg-yellow-500'
                                            : 'bg-green-500 animate-pulse'
                                        : 'bg-gray-400'
                                }`}
                                data-oid="15dji_t"
                            ></div>
                            <span
                                className="text-sm text-gray-600 dark:text-gray-400"
                                data-oid="y-omx2w"
                            >
                                {isRecording
                                    ? isPaused
                                        ? 'Recording Paused'
                                        : 'Recording Active'
                                    : 'Ready to Record'}
                            </span>
                        </div>
                    </div>

                    {/* Transcription Area */}
                    <div
                        className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-6"
                        data-oid="a8-u5uw"
                    >
                        <div className="flex justify-between items-center mb-4" data-oid="tgw26o2">
                            <h2
                                className="text-xl font-semibold text-gray-900 dark:text-gray-100"
                                data-oid="2dr5s.n"
                            >
                                Live Transcription
                            </h2>
                            <button
                                onClick={handleEnhanceTranscription}
                                disabled={!transcription.trim() || isEnhancing}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors duration-200"
                                data-oid="qp:.wso"
                            >
                                {isEnhancing ? 'Enhancing...' : 'Enhance Transcription'}
                            </button>
                        </div>
                        <div
                            className="h-full min-h-[300px] bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                            data-oid="c-jx-8p"
                        >
                            <textarea
                                value={transcription}
                                onChange={(e) => setTranscription(e.target.value)}
                                placeholder="Transcription will appear here as you speak..."
                                className="w-full h-full resize-none border-none outline-none bg-transparent text-gray-900 dark:text-gray-100 text-sm leading-relaxed"
                                data-oid="b4jtmu1"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column - Enhancement Output */}
                <div className="flex flex-col" data-oid="a3bc2_4">
                    <div
                        className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 h-full"
                        data-oid="2vpkimt"
                    >
                        <h2
                            className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4"
                            data-oid="i.r8m0o"
                        >
                            Meeting Enhancement
                        </h2>
                        <div
                            className="h-full min-h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                            data-oid="50isbz_"
                        >
                            {isEnhancing ? (
                                <div
                                    className="flex items-center justify-center h-full"
                                    data-oid="11fcu-d"
                                >
                                    <div className="text-center" data-oid="cokx0ik">
                                        <div
                                            className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"
                                            data-oid="_92z-29"
                                        ></div>
                                        <p
                                            className="text-gray-600 dark:text-gray-400"
                                            data-oid="8_qrf3o"
                                        >
                                            Enhancing transcription...
                                        </p>
                                    </div>
                                </div>
                            ) : enhancement ? (
                                <div
                                    className="text-gray-900 dark:text-gray-100 text-sm leading-relaxed whitespace-pre-wrap"
                                    data-oid="a:bg046"
                                >
                                    {enhancement}
                                </div>
                            ) : (
                                <div
                                    className="flex items-center justify-center h-full"
                                    data-oid="w2subyf"
                                >
                                    <p
                                        className="text-gray-500 dark:text-gray-400 text-center"
                                        data-oid="np7f60v"
                                    >
                                        Enhanced transcription will appear here after processing.
                                        <br data-oid="ngc16z4" />
                                        <span className="text-sm" data-oid="i310dha">
                                            Click "Enhance Transcription" to get started.
                                        </span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
