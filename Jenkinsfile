pipeline {

agent any

environment {
    IMAGE_NAME = "rajeshkosta/app"
    TAG = "${BUILD_NUMBER}"
    APP_LANG = ""
}

stages {

    stage('Checkout') {
        steps {
            checkout scm
            sh 'mkdir -p reports'
        }
    }

    stage('Gitleaks Scan') {
        steps {
            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                sh '''
                gitleaks detect \
                --source . \
                --report-format json \
                --report-path reports/gitleaks-report.json
                '''
            }
        }
    }

    stage('Trivy Filesystem Scan') {
        steps {
            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                sh '''
                trivy fs . \
                --format json \
                --output reports/trivy-fs-report.json
                '''
            }
        }
    }

    stage('Detect Language') {
        steps {
            script {

                if (fileExists('Application-Code/backend/pom.xml')) {
                    env.APP_LANG = "java"
                }
                else if (fileExists('Application-Code/backend/package.json')) {
                    env.APP_LANG = "nodejs"
                }
                else if (fileExists('Application-Code/backend/requirements.txt')) {
                    env.APP_LANG = "python"
                }
                else if (fileExists('Application-Code/backend/go.mod')) {
                    env.APP_LANG = "golang"
                }
                else {
                    error("Unsupported Language")
                }

                echo "Detected Language: ${env.APP_LANG}"
            }
        }
    }

    stage('Backend Build') {
        steps {
            script {

                switch(env.APP_LANG) {

                    case "java":
                        dir('Application-Code/backend') {
                            sh 'mvn clean package -DskipTests'
                        }
                        break

                    case "nodejs":
                        dir('Application-Code/backend') {
                            sh '''
                            npm install
                            npm run build
                            '''
                        }
                        break

                    case "python":
                        dir('Application-Code/backend') {
                            sh '''
                            python3 -m venv venv
                            . venv/bin/activate
                            pip install -r requirements.txt
                            '''
                        }
                        break

                    case "golang":
                        dir('Application-Code/backend') {
                            sh 'go build ./...'
                        }
                        break
                }
            }
        }
    }

    stage('Frontend Build') {

        when {
            expression {
                fileExists('Application-Code/frontend/package.json')
            }
        }

        steps {

            dir('Application-Code/frontend') {

                sh '''
                export NODE_OPTIONS=--openssl-legacy-provider
                npm install
                npm run build
                '''
            }
        }
    }

    stage('Unit Tests') {

        steps {

            script {

                switch(env.APP_LANG) {

                    case "java":
                        dir('Application-Code/backend') {
                            sh 'mvn test'
                        }
                        break

                    case "nodejs":
                        dir('Application-Code/backend') {
                            sh 'npm test || true'
                        }
                        break

                    case "python":
                        dir('Application-Code/backend') {
                            sh '''
                            . venv/bin/activate
                            pytest || true
                            '''
                        }
                        break

                    case "golang":
                        dir('Application-Code/backend') {
                            sh 'go test ./... || true'
                        }
                        break
                }
            }
        }
    }

    stage('SonarQube Scan') {

        when {
            expression {
                env.APP_LANG == "java"
            }
        }

        steps {

            withSonarQubeEnv('sonar') {

                dir('Application-Code/backend') {

                    sh '''
                    mvn sonar:sonar \
                    -Dsonar.projectKey=backend
                    '''
                }
            }
        }
    }

    stage('Build Docker Image') {

        steps {

            sh """
            docker build \
            -t ${IMAGE_NAME}:${TAG} .
            """
        }
    }

    stage('Trivy Image Scan') {

        steps {

            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {

                sh """
                trivy image \
                --format json \
                --output reports/trivy-image-report.json \
                ${IMAGE_NAME}:${TAG}
                """
            }
        }
    }

    stage('Push Docker Image') {

        steps {

            withCredentials([
                usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )
            ]) {

                sh '''
                echo $DOCKER_PASS | docker login \
                -u $DOCKER_USER \
                --password-stdin
                '''

                sh """
                docker push ${IMAGE_NAME}:${TAG}
                """
            }
        }
    }
}

post {

    always {

        archiveArtifacts(
            artifacts: '''
            reports/**/*,
            **/target/*.jar,
            **/target/surefire-reports/**/*,
            **/dist/**/*,
            **/build/**/*,
            **/*.log
            '''.trim(),
            fingerprint: true,
            allowEmptyArchive: true
        )

        cleanWs()
    }

    success {
        echo 'Pipeline Success'
    }

    unstable {
        echo 'Pipeline Completed With Security Findings'
    }

    failure {
        echo 'Pipeline Failed'
    }
}

}
