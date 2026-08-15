# API Design

Base URL: `/api/v1`

Swagger: `/api/docs`

## Auth

| Method | Path | Description |
| --- | --- | --- |
| POST | `/auth/register` | Register a user and assign default student role |
| POST | `/auth/login` | Authenticate and issue tokens |
| POST | `/auth/refresh` | Rotate refresh token and issue a new access token |
| POST | `/auth/logout` | Revoke refresh token |
| GET | `/auth/me` | Return current authenticated user |

## Academic

| Method | Path | Description |
| --- | --- | --- |
| GET | `/subjects` | List subjects |
| POST | `/subjects` | Create subject |
| GET | `/courses` | List courses |
| POST | `/courses` | Create course |

## Exams

| Method | Path | Description |
| --- | --- | --- |
| GET | `/exams` | List exams |
| POST | `/exams` | Create exam |
| PATCH | `/exams/:id/publish` | Publish exam |
| GET | `/questions` | List question bank items |
| POST | `/questions` | Create question with options |
| POST | `/exam-sessions/:examId/start` | Start or resume a student session |
| PATCH | `/exam-sessions/:sessionId/answers` | Autosave answer |
| POST | `/exam-sessions/:sessionId/violations` | Log violation |
| POST | `/submissions` | Submit an exam |
| GET | `/results` | List results |

## Reporting

| Method | Path | Description |
| --- | --- | --- |
| GET | `/reports/exams/:examId` | Exam analytics report |
| GET | `/reports/students/:studentId` | Student performance report |
| GET | `/audit-logs` | Security and administrative audit trail |
